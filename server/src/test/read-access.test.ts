import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { adminPool } from "../db/admin.js";
import { pool } from "../db/pool.js";
import { withRlsTx, type RlsContext } from "../db/rls.js";

// Proves the read visibility rule for results/history/compare at the DATABASE layer: a
// state assessor of one state cannot see another state's assessment, the owning state's
// assessor can, and the Centre can (submitted only). Self-contained fixture.

const DUMMY_USER = "00000000-0000-0000-0000-000000000000";
let ownState = "";
let otherState = "";
let assessmentId = "";

async function countVisible(ctx: RlsContext): Promise<number> {
  return withRlsTx(ctx, async (c) => {
    const r = await c.query<{ n: number }>(
      "SELECT count(*)::int AS n FROM assessments WHERE id = $1",
      [assessmentId],
    );
    return r.rows[0]!.n;
  });
}

before(async () => {
  const states = await adminPool.query<{ id: string }>("SELECT id FROM states ORDER BY name LIMIT 2");
  ownState = states.rows[0]!.id;
  otherState = states.rows[1]!.id;
  const mv = await adminPool.query<{ id: string }>("SELECT id FROM model_versions ORDER BY published_at DESC LIMIT 1");
  const a = await adminPool.query<{ id: string }>(
    `INSERT INTO assessments (state_id, model_version_id, status, assessor_name, submitted_at, locked_at)
     VALUES ($1, $2, 'submitted', 'Access Test', now(), now() + interval '7 days')
     RETURNING id`,
    [ownState, mv.rows[0]!.id],
  );
  assessmentId = a.rows[0]!.id;
});

after(async () => {
  await adminPool.query("DELETE FROM assessments WHERE id = $1", [assessmentId]);
  await pool.end();
  await adminPool.end();
});

test("another state's assessor cannot see the assessment (0 rows via RLS)", async () => {
  const n = await countVisible({ userId: DUMMY_USER, role: "state_assessor", stateId: otherState });
  assert.equal(n, 0);
});

test("the owning state's assessor can see it", async () => {
  const n = await countVisible({ userId: DUMMY_USER, role: "state_assessor", stateId: ownState });
  assert.equal(n, 1);
});

test("the Centre can see the submitted assessment", async () => {
  const n = await countVisible({ userId: DUMMY_USER, role: "centre", stateId: null });
  assert.equal(n, 1);
});
