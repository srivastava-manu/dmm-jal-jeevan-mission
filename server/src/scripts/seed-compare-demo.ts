import { adminPool } from "../db/admin.js";

// Demo scaffolding for cross-version compare: creates an earlier v2.1 assessment for Andhra
// Pradesh, while leaving the v2.1 model rows and the current v2.2 assessment unchanged.
// Idempotent and intentionally limited to the development/demo database.

const EARLIER_VERSION = "v2.1";
const CURRENT_VERSION = "v2.2";
const STATE = "Andhra Pradesh";

async function main(): Promise<void> {
  const c = await adminPool.connect();
  try {
    await c.query("BEGIN");

    const models = await c.query<{ id: string; version: string }>(
      "SELECT id, version FROM model_versions WHERE version = ANY($1::text[])",
      [[EARLIER_VERSION, CURRENT_VERSION]],
    );
    const earlierModel = models.rows.find((m) => m.version === EARLIER_VERSION);
    const currentModel = models.rows.find((m) => m.version === CURRENT_VERSION);
    if (!earlierModel || !currentModel) {
      throw new Error(`Expected ${EARLIER_VERSION} and ${CURRENT_VERSION}; run db:migrate first.`);
    }

    const state = (
      await c.query<{ id: string }>("SELECT id FROM states WHERE name = $1", [STATE])
    ).rows[0];
    if (!state) throw new Error(`Seed state not found: ${STATE}`);

    const cur = (
      await c.query<{ id: string }>(
        `SELECT a.id
           FROM assessments a
          WHERE a.state_id = $1
            AND a.status = 'submitted'
            AND a.model_version_id = $2
          ORDER BY a.submitted_at DESC
          LIMIT 1`,
        [state.id, currentModel.id],
      )
    ).rows[0];
    if (!cur) {
      throw new Error(`${STATE} has no submitted ${CURRENT_VERSION} assessment — run db:seed:demo first.`);
    }

    const currentValues = new Map<string, number>();
    for (const row of (
      await c.query<{ name: string; value: number }>(
        `SELECT cap.name, s.value
           FROM scores s
           JOIN capabilities cap ON cap.id = s.capability_id
          WHERE s.assessment_id = $1
            AND s.value IS NOT NULL`,
        [cur.id],
      )
    ).rows) {
      currentValues.set(row.name, row.value);
    }

    await c.query(
      "DELETE FROM assessments WHERE state_id = $1 AND model_version_id = $2",
      [state.id, earlierModel.id],
    );

    const earlier = (
      await c.query<{ id: string }>(
        `INSERT INTO assessments
          (state_id, model_version_id, status, assessor_name, assessor_designation, submitted_at, locked_at)
         VALUES
          ($1, $2, 'submitted', 'K. Raghavendra', 'Joint Director (IT)',
           timestamptz '2026-05-01 12:00:00+00', timestamptz '2026-05-08 12:00:00+00')
         RETURNING id`,
        [state.id, earlierModel.id],
      )
    ).rows[0]!;

    const earlierCaps = (
      await c.query<{ id: string; name: string }>(
        `SELECT id, name
           FROM capabilities
          WHERE model_version_id = $1
          ORDER BY layer_index, order_in_layer`,
        [earlierModel.id],
      )
    ).rows;

    const clamp = (n: number) => Math.max(0, Math.min(4, n));
    let comparableSeen = 0;
    for (const cap of earlierCaps) {
      const base = currentValues.get(cap.name);
      let value: number;
      if (base === undefined) {
        value = 2; // Retired in v2.2; compare must mark it not comparable.
      } else {
        comparableSeen++;
        if (comparableSeen <= 3) value = clamp(base - 1);
        else if (comparableSeen <= 5) value = clamp(base + 1);
        else value = base;
      }
      await c.query(
        "INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, $3)",
        [earlier.id, cap.id, value],
      );
    }

    await c.query("COMMIT");
    console.log("Cross-version compare demo ready.");
    console.log(`  current  (${CURRENT_VERSION}) assessment id: ${cur.id}`);
    console.log(`  earlier  (${EARLIER_VERSION}) assessment id: ${earlier.id}`);
    console.log(`  compare: GET /api/assessments/${cur.id}/compare?to=${earlier.id}`);
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