import fs from "node:fs/promises";
import path from "node:path";
import vm from "node:vm";
import type { PoolClient } from "pg";
import { adminPool } from "../db/admin.js";
import { REPO_ROOT, seed as seedCfg } from "../config.js";
import { hashPassword } from "../auth/password.js";

// OPTIONAL demo data for previewing the national dashboard. It seeds an assessor per
// state in njjm-centre-data.js and 20 SUBMITTED assessments, leaving 4 states with an
// assessor but no submission. The model itself is NOT seeded here — that comes only from
// migration 004 — so this reads the model version and capabilities out of the database.
//
// This is preview data, not the production flow (in production the Centre creates
// assessors and states submit their own assessments).

interface CentreState {
  name: string;
  assessor: string;
  designation: string;
  email: string;
  submitted: string | null;
  total: number | null;
  scores: number[] | null;
}

async function loadCentreStates(): Promise<CentreState[]> {
  const code = await fs.readFile(path.join(REPO_ROOT, "njjm-centre-data.js"), "utf8");
  const sandbox: { window: Record<string, unknown> } = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return (sandbox.window.NJJM_CENTRE as { STATES: CentreState[] }).STATES;
}

const MONTHS: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06",
  Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

function parseSeedDate(s: string): string {
  const [dd, mon, yyyy] = s.split(" ");
  const mm = MONTHS[mon ?? ""];
  if (!dd || !mm || !yyyy) throw new Error(`Unparseable seed date: ${s}`);
  return `${yyyy}-${mm}-${dd.padStart(2, "0")}T12:00:00Z`;
}

async function currentModel(client: PoolClient): Promise<{ id: string; version: string }> {
  const r = await client.query<{ id: string; version: string }>(
    "SELECT id, version FROM model_versions ORDER BY published_at DESC LIMIT 1",
  );
  if (!r.rows[0]) {
    throw new Error("No model version found. Run `npm run db:migrate` first (migration 004).");
  }
  return r.rows[0];
}

async function main(): Promise<void> {
  if (!seedCfg.assessorPassword) {
    throw new Error("Set SEED_ASSESSOR_PASSWORD in .env before seeding.");
  }

  const centreStates = await loadCentreStates();
  const client = await adminPool.connect();
  try {
    await client.query("BEGIN");

    const model = await currentModel(client);

    // Map (layer_index * 6 + order_in_layer) -> capability id, for the current version.
    const caps = await client.query<{
      id: string;
      layer_index: number;
      order_in_layer: number;
    }>(
      "SELECT id, layer_index, order_in_layer FROM capabilities WHERE model_version_id = $1",
      [model.id],
    );
    const capId = new Map<number, string>();
    for (const r of caps.rows) capId.set(r.layer_index * 6 + r.order_in_layer, r.id);

    // Resolve seeded states and clear prior demo assessments for idempotency.
    const stateIds = new Map<string, string>();
    for (const st of centreStates) {
      const row = await client.query<{ id: string }>(
        "SELECT id FROM states WHERE name = $1",
        [st.name],
      );
      if (!row.rows[0]) throw new Error(`Demo seed references unknown state: ${st.name}`);
      stateIds.set(st.name, row.rows[0].id);
    }
    await client.query("DELETE FROM assessments WHERE state_id = ANY($1::uuid[])", [
      [...stateIds.values()],
    ]);

    const assessorHash = await hashPassword(seedCfg.assessorPassword);
    let submitted = 0;
    let assessors = 0;

    for (const st of centreStates) {
      const stateId = stateIds.get(st.name)!;

      const userRow = await client.query<{ id: string }>(
        `INSERT INTO users (email, name, designation, role, state_id, password_hash, active)
         VALUES ($1, $2, $3, 'state_assessor', $4, $5, true)
         ON CONFLICT (lower(email)) DO UPDATE SET
           name = EXCLUDED.name, designation = EXCLUDED.designation,
           state_id = EXCLUDED.state_id, active = true
         RETURNING id`,
        [st.email, st.assessor, st.designation, stateId, assessorHash],
      );
      const userId = userRow.rows[0]!.id;
      assessors++;

      if (!st.submitted || !st.scores) continue;

      const submittedAt = parseSeedDate(st.submitted);
      const a = await client.query<{ id: string }>(
        `INSERT INTO assessments
           (state_id, assessor_user_id, model_version_id, status,
            assessor_name, assessor_designation, submitted_at, locked_at)
         VALUES ($1, $2, $3, 'submitted', $4, $5, $6::timestamptz,
                 $6::timestamptz + interval '7 days')
         RETURNING id`,
        [stateId, userId, model.id, st.assessor, st.designation, submittedAt],
      );
      const assessmentId = a.rows[0]!.id;

      for (let i = 0; i < st.scores.length; i++) {
        const cid = capId.get(i);
        if (!cid) throw new Error(`No capability for score index ${i}`);
        await client.query(
          "INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, $3)",
          [assessmentId, cid, st.scores[i]],
        );
      }
      submitted++;
    }

    await client.query("COMMIT");
    console.log(
      `Demo data (model ${model.version}): ${assessors} assessor states, ` +
        `${submitted} submitted, ${assessors - submitted} with an assessor but no submission.`,
    );
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
