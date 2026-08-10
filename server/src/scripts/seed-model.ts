import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import type { PoolClient } from "pg";
import { adminPool } from "../db/admin.js";
import { REPO_ROOT, seed as seedCfg } from "../config.js";
import { hashPassword } from "../auth/password.js";

// Seeds the versioned model and a realistic national picture, so the Centre dashboard has
// real SUBMITTED assessments to aggregate. The content is loaded from the authoritative
// design files (dmm-model.js, njjm-centre-data.js) rather than duplicated here — those
// files "must become database rows", which is exactly what this does.

interface Capability {
  n: string;
  m: string;
  inc: string[];
}
interface Layer {
  name: string;
  covers: string;
  caps: Capability[];
}
interface DmmModel {
  MODEL_VERSION: string;
  LAYERS: Layer[];
}
interface CentreState {
  name: string;
  assessor: string;
  designation: string;
  email: string;
  submitted: string | null; // "12 Jul 2026" or null
  total: number | null;
  scores: number[] | null; // 48 values, index = layer*6 + order
}

/** Run a browser-style `window.X = ...` data file in a sandbox and return `window`. */
async function loadWindowGlobals(relPath: string): Promise<Record<string, unknown>> {
  const code = await fs.readFile(path.join(REPO_ROOT, relPath), "utf8");
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox.window;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

/** "12 Jul 2026" -> ISO timestamptz at local noon (deterministic, no Date parsing). */
function parseSeedDate(s: string): string {
  const [dd, mon, yyyy] = s.split(" ");
  const mm = MONTHS[mon ?? ""];
  if (!dd || !mm || !yyyy) throw new Error(`Unparseable seed date: ${s}`);
  return `${yyyy}-${mm}-${dd.padStart(2, "0")}T12:00:00Z`;
}

async function seedModel(client: PoolClient, model: DmmModel): Promise<string> {
  const mv = await client.query<{ id: string }>(
    `INSERT INTO model_versions (version, notes)
     VALUES ($1, $2)
     ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes
     RETURNING id`,
    [model.MODEL_VERSION, "Seeded from dmm-model.js"],
  );
  const modelVersionId = mv.rows[0]!.id;

  for (let li = 0; li < model.LAYERS.length; li++) {
    const layer = model.LAYERS[li]!;
    for (let oi = 0; oi < layer.caps.length; oi++) {
      const cap = layer.caps[oi]!;
      await client.query(
        `INSERT INTO capabilities
           (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (model_version_id, layer_index, order_in_layer) DO UPDATE SET
           layer_name = EXCLUDED.layer_name,
           layer_covers = EXCLUDED.layer_covers,
           name = EXCLUDED.name,
           measure = EXCLUDED.measure,
           includes = EXCLUDED.includes`,
        [modelVersionId, li, layer.name, layer.covers, oi, cap.n, cap.m, cap.inc],
      );
    }
  }
  console.log(`Model ${model.MODEL_VERSION}: 8 layers, 48 capabilities.`);
  return modelVersionId;
}

async function main(): Promise<void> {
  if (!seedCfg.assessorPassword) {
    throw new Error("Set SEED_ASSESSOR_PASSWORD in .env before seeding.");
  }

  const model = (await loadWindowGlobals("dmm-model.js")).DMM_MODEL as DmmModel;
  const centre = (await loadWindowGlobals("njjm-centre-data.js")).NJJM_CENTRE as {
    STATES: CentreState[];
  };

  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");

    const modelVersionId = await seedModel(client, model);

    // Map (layer_index, order_in_layer) -> capability id.
    const caps = await client.query<{
      id: string;
      layer_index: number;
      order_in_layer: number;
    }>(
      "SELECT id, layer_index, order_in_layer FROM capabilities WHERE model_version_id = $1",
      [modelVersionId],
    );
    const capId = new Map<number, string>();
    for (const r of caps.rows) capId.set(r.layer_index * 6 + r.order_in_layer, r.id);

    // Resolve the seeded states by name, and clear any prior seeded assessments so this
    // script is idempotent (scores cascade on assessment delete).
    const stateIds = new Map<string, string>();
    for (const st of centre.STATES) {
      const row = await client.query<{ id: string }>(
        "SELECT id FROM states WHERE name = $1",
        [st.name],
      );
      if (!row.rows[0]) throw new Error(`Centre seed references unknown state: ${st.name}`);
      stateIds.set(st.name, row.rows[0].id);
    }
    await client.query(
      `DELETE FROM assessments WHERE state_id = ANY($1::uuid[])`,
      [[...stateIds.values()]],
    );

    const assessorHash = await hashPassword(seedCfg.assessorPassword);
    let submittedCount = 0;
    let assessorCount = 0;

    for (const st of centre.STATES) {
      const stateId = stateIds.get(st.name)!;

      // One active assessor per state (business rule #6).
      const userRow = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, designation, role, state_id, password_hash, active)
         VALUES ($1, $2, $3, 'state_assessor', $4, $5, true)
         ON CONFLICT (lower(email)) DO UPDATE SET
           name = EXCLUDED.name,
           designation = EXCLUDED.designation,
           state_id = EXCLUDED.state_id,
           active = true
         RETURNING id`,
        [st.email, st.assessor, st.designation, stateId, assessorHash],
      );
      const userId = userRow.rows[0]!.id;
      assessorCount++;

      // A state with no submission date has an assessor but has NOT submitted — it must be
      // absent from every national average, yet counted among "states with an assessor".
      if (!st.submitted || !st.scores) continue;

      const submittedAt = parseSeedDate(st.submitted);
      const a = await client.query<{ id: string }>(
        `INSERT INTO assessments
           (state_id, assessor_user_id, model_version_id, status,
            assessor_name, assessor_designation, submitted_at, locked_at)
         VALUES ($1, $2, $3, 'submitted', $4, $5, $6::timestamptz,
                 $6::timestamptz + interval '7 days')
         RETURNING id`,
        [stateId, userId, modelVersionId, st.assessor, st.designation, submittedAt],
      );
      const assessmentId = a.rows[0]!.id;

      for (let i = 0; i < st.scores.length; i++) {
        const cid = capId.get(i);
        if (!cid) throw new Error(`No capability for score index ${i}`);
        await client.query(
          `INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, $3)`,
          [assessmentId, cid, st.scores[i]],
        );
      }
      submittedCount++;
    }

    await client.query("COMMIT");
    console.log(
      `Seeded ${assessorCount} assessor states — ${submittedCount} submitted, ` +
        `${assessorCount - submittedCount} with an assessor but no submission.`,
    );
    console.log("National dashboard now has data. Sign in as centre@njjm.gov.in.");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await adminPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
