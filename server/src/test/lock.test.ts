import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { adminPool } from "../db/admin.js";
import { pool } from "../db/pool.js";
import { withRlsTx, type RlsContext } from "../db/rls.js";

// Proves the 7-day lock is enforced by RLS itself, independent of the API. We build a
// self-contained fixture (a submitted+locked assessment and a submitted-but-unlocked one),
// then attempt score writes through the app-role connection in the assessor's RLS context,
// bypassing the API's assertEditable check entirely.

const DUMMY_USER = "00000000-0000-0000-0000-000000000000"; // scores policies key on state, not user

let stateId = "";
let capId = "";
let lockedId = "";
let unlockedId = "";

function ctx(): RlsContext {
  return { userId: DUMMY_USER, role: "state_assessor", stateId };
}

async function makeAssessment(lockedAtSql: string, submittedAtSql: string): Promise<string> {
  const mv = await adminPool.query<{ id: string }>(
    "SELECT id FROM model_versions ORDER BY published_at DESC LIMIT 1",
  );
  const a = await adminPool.query<{ id: string }>(
    `INSERT INTO assessments (state_id, model_version_id, status, assessor_name, submitted_at, locked_at)
     VALUES ($1, $2, 'submitted', 'Lock Test', ${submittedAtSql}, ${lockedAtSql})
     RETURNING id`,
    [stateId, mv.rows[0]!.id],
  );
  const id = a.rows[0]!.id;
  await adminPool.query(
    "INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, 2)",
    [id, capId],
  );
  return id;
}

before(async () => {
  stateId = (await adminPool.query<{ id: string }>("SELECT id FROM states ORDER BY name LIMIT 1")).rows[0]!.id;
  capId = (
    await adminPool.query<{ id: string }>(
      "SELECT id FROM capabilities ORDER BY layer_index, order_in_layer LIMIT 1",
    )
  ).rows[0]!.id;
  lockedId = await makeAssessment("now() - interval '1 day'", "now() - interval '8 days'");
  unlockedId = await makeAssessment("now() + interval '7 days'", "now()");
});

after(async () => {
  await adminPool.query("DELETE FROM assessments WHERE id = ANY($1::uuid[])", [[lockedId, unlockedId]]);
  await pool.end();
  await adminPool.end();
});

test("RLS refuses a score write on a LOCKED assessment (API check bypassed)", async () => {
  const affected = await withRlsTx(ctx(), async (c) => {
    const r = await c.query(
      "UPDATE scores SET value = 4 WHERE assessment_id = $1 AND capability_id = $2",
      [lockedId, capId],
    );
    return r.rowCount ?? 0;
  });
  assert.equal(affected, 0, "no rows may be updated on a locked assessment");

  const after = await adminPool.query<{ value: number }>(
    "SELECT value FROM scores WHERE assessment_id = $1 AND capability_id = $2",
    [lockedId, capId],
  );
  assert.equal(after.rows[0]!.value, 2, "the value must be unchanged");
});

test("RLS allows a score write within the 7-day window (submitted, not yet locked)", async () => {
  const affected = await withRlsTx(ctx(), async (c) => {
    const r = await c.query(
      "UPDATE scores SET value = 4 WHERE assessment_id = $1 AND capability_id = $2",
      [unlockedId, capId],
    );
    return r.rowCount ?? 0;
  });
  assert.equal(affected, 1, "a write within the lock window is permitted");

  const after = await adminPool.query<{ value: number }>(
    "SELECT value FROM scores WHERE assessment_id = $1 AND capability_id = $2",
    [unlockedId, capId],
  );
  assert.equal(after.rows[0]!.value, 4, "the value must be updated");
});
