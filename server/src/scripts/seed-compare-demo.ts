import { adminPool } from "../db/admin.js";

// Demo scaffolding for cross-version compare: an EARLIER model version (v2.0) in which one
// capability had a different name, plus a v2.0 submitted assessment for Andhra Pradesh dated
// before its v2.1 rounds. v2.0 is published before v2.1, so it never becomes the "current"
// version (the national dashboard and new drafts stay on v2.1). Idempotent.
//
// The rename: v2.0 "Elasticity & Capacity Management" -> v2.1 "Elasticity & Performance
// Management". Comparing a v2.1 assessment to this v2.0 one yields exactly two "not
// comparable" capabilities (one added, one retired) and 47 comparable.

const OLD_NAME = "Elasticity & Capacity Management";
const NEW_NAME = "Elasticity & Performance Management";
const STATE = "Andhra Pradesh";

async function main(): Promise<void> {
  const c = await adminPool.connect();
  try {
    await c.query("BEGIN");

    const mv21 = (await c.query<{ id: string }>("SELECT id FROM model_versions WHERE version = 'v2.1'")).rows[0];
    if (!mv21) throw new Error("v2.1 not seeded — run db:migrate first.");

    // v2.0 published strictly before v2.1 so it is never the current version.
    const mv20 = (
      await c.query<{ id: string }>(
        `INSERT INTO model_versions (version, published_at, notes)
         VALUES ('v2.0',
                 (SELECT published_at FROM model_versions WHERE version = 'v2.1') - interval '5 months',
                 'Measure text revised after stakeholder review.')
         ON CONFLICT (version) DO UPDATE SET notes = EXCLUDED.notes, published_at = EXCLUDED.published_at
         RETURNING id`,
      )
    ).rows[0]!.id;

    // v2.0 capabilities = v2.1's, with the one capability under its old name.
    await c.query(
      `INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
       SELECT $1, layer_index, layer_name, layer_covers, order_in_layer,
              CASE WHEN name = $3 THEN $2 ELSE name END, measure, includes
       FROM capabilities WHERE model_version_id = $4
       ON CONFLICT (model_version_id, layer_index, order_in_layer) DO NOTHING`,
      [mv20, OLD_NAME, NEW_NAME, mv21.id],
    );

    const stateId = (await c.query<{ id: string }>("SELECT id FROM states WHERE name = $1", [STATE])).rows[0]!.id;

    // The v2.1 assessment we will compare FROM (most recent submitted for the state).
    const cur = (
      await c.query<{ id: string }>(
        `SELECT a.id FROM assessments a
         WHERE a.state_id = $1 AND a.status = 'submitted' AND a.model_version_id = $2
         ORDER BY a.submitted_at DESC LIMIT 1`,
        [stateId, mv21.id],
      )
    ).rows[0];
    if (!cur) throw new Error(`${STATE} has no submitted v2.1 assessment — run db:seed:demo first.`);

    // Its current values, keyed by capability name.
    const curVals = new Map<string, number>();
    for (const r of (
      await c.query<{ name: string; value: number }>(
        `SELECT cap.name, s.value FROM scores s JOIN capabilities cap ON cap.id = s.capability_id
         WHERE s.assessment_id = $1 AND s.value IS NOT NULL`,
        [cur.id],
      )
    ).rows) {
      curVals.set(r.name, r.value);
    }

    // Fresh v2.0 submitted assessment, dated before the v2.1 rounds.
    await c.query("DELETE FROM assessments WHERE state_id = $1 AND model_version_id = $2", [stateId, mv20]);
    const a20 = (
      await c.query<{ id: string }>(
        `INSERT INTO assessments (state_id, model_version_id, status, assessor_name, assessor_designation, submitted_at, locked_at)
         VALUES ($1, $2, 'submitted', 'K. Raghavendra', 'Joint Director (IT)',
                 timestamptz '2026-06-01 12:00:00+00', timestamptz '2026-06-08 12:00:00+00')
         RETURNING id`,
        [stateId, mv20],
      )
    ).rows[0]!.id;

    // v2.0 values: mostly equal to the current v2.1 values (comparable "same"), with a few
    // deliberate deltas so compare shows improved and slipped. The renamed capability is
    // "not comparable", so its value never enters the counts.
    const v20caps = (
      await c.query<{ id: string; name: string; layer_index: number; order_in_layer: number }>(
        "SELECT id, name, layer_index, order_in_layer FROM capabilities WHERE model_version_id = $1 ORDER BY layer_index, order_in_layer",
        [mv20],
      )
    ).rows;

    const clamp = (n: number) => Math.max(0, Math.min(4, n));
    let comparableSeen = 0;
    for (const cap of v20caps) {
      let value: number;
      if (cap.name === OLD_NAME) {
        value = 2; // not comparable — excluded from the counts
      } else {
        const base = curVals.get(cap.name) ?? 2;
        comparableSeen++;
        // First 3 comparable caps: earlier lower -> current improved. Next 2: earlier higher
        // -> current slipped. Rest: equal.
        if (comparableSeen <= 3) value = clamp(base - 1);
        else if (comparableSeen <= 5) value = clamp(base + 1);
        else value = base;
      }
      await c.query("INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, $3)", [a20, cap.id, value]);
    }

    await c.query("COMMIT");
    console.log("Cross-version compare demo ready.");
    console.log(`  current  (v2.1) assessment id: ${cur.id}`);
    console.log(`  earlier  (v2.0) assessment id: ${a20}`);
    console.log(`  compare: GET /api/assessments/${cur.id}/compare?to=${a20}`);
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await adminPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
