import { adminPool } from "../db/admin.js";
import { pool } from "../db/pool.js";
import { withRlsTx } from "../db/rls.js";

// Proves the RLS half of the 7-day lock: it writes a score DIRECTLY through the app-role
// connection in the assessor's RLS context, deliberately bypassing the API's assertEditable
// check. If RLS is doing its job, the write affects 0 rows and the value is unchanged — the
// database refuses it regardless of what the application code does.
//
// Usage: tsx src/scripts/rls-lock-proof.ts <assessmentId> <capabilityId>

const assessmentId = process.argv[2];
const capabilityId = process.argv[3];

async function main(): Promise<void> {
  if (!assessmentId || !capabilityId) {
    throw new Error("Usage: rls-lock-proof <assessmentId> <capabilityId>");
  }

  // Ground truth via the admin (RLS-bypassing) connection.
  const a = await adminPool.query<{
    state_id: string;
    assessor_user_id: string;
    locked_at: string | null;
    value: number | null;
  }>(
    `SELECT a.state_id, a.assessor_user_id, a.locked_at, s.value
     FROM assessments a
     JOIN scores s ON s.assessment_id = a.id AND s.capability_id = $2
     WHERE a.id = $1`,
    [assessmentId, capabilityId],
  );
  const row = a.rows[0];
  if (!row) throw new Error("assessment/score not found");

  const ctx = {
    userId: row.assessor_user_id,
    role: "state_assessor" as const,
    stateId: row.state_id,
  };
  const before = row.value;
  const target = before === 4 ? 0 : 4;
  console.log(`locked_at = ${row.locked_at}`);
  console.log(`value before = ${before}; attempting to set ${target} via direct SQL (API lock check bypassed)…`);

  let rowCount = -1;
  let error: string | null = null;
  try {
    await withRlsTx(ctx, async (c) => {
      const r = await c.query(
        "UPDATE scores SET value = $3 WHERE assessment_id = $1 AND capability_id = $2",
        [assessmentId, capabilityId, target],
      );
      rowCount = r.rowCount ?? 0;
    });
  } catch (e) {
    error = (e as Error).message;
  }

  const after = (
    await adminPool.query<{ value: number | null }>(
      "SELECT value FROM scores WHERE assessment_id = $1 AND capability_id = $2",
      [assessmentId, capabilityId],
    )
  ).rows[0]!.value;

  console.log(`UPDATE rowCount = ${rowCount}${error ? `  (error: ${error})` : ""}`);
  console.log(`value after = ${after}`);
  console.log(
    after === before
      ? "✅ RLS REFUSED the write — value unchanged, enforced independently of the API."
      : "❌ the write took effect — RLS did NOT block it",
  );

  await pool.end();
  await adminPool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
