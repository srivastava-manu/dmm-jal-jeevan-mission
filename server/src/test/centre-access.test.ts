import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { adminPool } from "../db/admin.js";
import { pool } from "../db/pool.js";
import { withRlsTx, type RlsContext } from "../db/rls.js";

// Proves at the DATABASE layer that (a) a Centre user cannot see a draft assessment, and
// (b) a Centre user cannot write scores anywhere — even with a null state_id, the state
// tables do not fall through to "sees/writes everything".

const DUMMY = "00000000-0000-0000-0000-000000000000";
const centre: RlsContext = { userId: DUMMY, role: "centre", stateId: null };

let draftId = "";
let submittedId = "";
let cap1 = "";
let cap2 = "";

before(async () => {
  const state = (await adminPool.query<{ id: string }>("SELECT id FROM states ORDER BY name LIMIT 1")).rows[0]!.id;
  const mv = (await adminPool.query<{ id: string }>("SELECT id FROM model_versions ORDER BY published_at DESC LIMIT 1")).rows[0]!.id;
  const caps = await adminPool.query<{ id: string }>(
    "SELECT id FROM capabilities WHERE model_version_id = $1 ORDER BY layer_index, order_in_layer LIMIT 2",
    [mv],
  );
  cap1 = caps.rows[0]!.id;
  cap2 = caps.rows[1]!.id;

  draftId = (
    await adminPool.query<{ id: string }>(
      "INSERT INTO assessments (state_id, model_version_id, status) VALUES ($1, $2, 'draft') RETURNING id",
      [state, mv],
    )
  ).rows[0]!.id;
  submittedId = (
    await adminPool.query<{ id: string }>(
      `INSERT INTO assessments (state_id, model_version_id, status, assessor_name, submitted_at, locked_at)
       VALUES ($1, $2, 'submitted', 'Centre Test', now(), now() + interval '7 days') RETURNING id`,
      [state, mv],
    )
  ).rows[0]!.id;
  await adminPool.query("INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, 2)", [submittedId, cap1]);
});

after(async () => {
  await adminPool.query("DELETE FROM assessments WHERE id = ANY($1::uuid[])", [[draftId, submittedId]]);
  await pool.end();
  await adminPool.end();
});

test("Centre cannot see a draft assessment (RLS)", async () => {
  const n = await withRlsTx(centre, async (c) => {
    const r = await c.query<{ n: number }>("SELECT count(*)::int AS n FROM assessments WHERE id = $1", [draftId]);
    return r.rows[0]!.n;
  });
  assert.equal(n, 0);
});

test("Centre CAN see a submitted assessment (control)", async () => {
  const n = await withRlsTx(centre, async (c) => {
    const r = await c.query<{ n: number }>("SELECT count(*)::int AS n FROM assessments WHERE id = $1", [submittedId]);
    return r.rows[0]!.n;
  });
  assert.equal(n, 1);
});

test("Centre INSERT into scores is refused by RLS", async () => {
  await assert.rejects(
    () =>
      withRlsTx(centre, (c) =>
        c.query("INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1, $2, 3)", [submittedId, cap2]),
      ),
    /row-level security/i,
  );
});

test("Centre UPDATE of a score affects 0 rows (RLS), value unchanged", async () => {
  const affected = await withRlsTx(centre, async (c) => {
    const r = await c.query("UPDATE scores SET value = 4 WHERE assessment_id = $1 AND capability_id = $2", [submittedId, cap1]);
    return r.rowCount ?? 0;
  });
  assert.equal(affected, 0);
  const after = await adminPool.query<{ value: number }>(
    "SELECT value FROM scores WHERE assessment_id = $1 AND capability_id = $2",
    [submittedId, cap1],
  );
  assert.equal(after.rows[0]!.value, 2);
});
