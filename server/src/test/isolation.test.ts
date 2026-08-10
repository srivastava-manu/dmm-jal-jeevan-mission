import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { adminPool } from "../db/admin.js";
import { pool, assertAppRoleIsUnprivileged } from "../db/pool.js";
import { withRlsTx, type RlsContext } from "../db/rls.js";
import { getUserById, listVisibleUsers, listStates } from "../db/index.js";

// These tests run against the APP connection (dmm_app), so RLS is enforced exactly as it
// is for real requests. They prove the guarantee is the database engine's, not the app
// code's: even a query with no WHERE clause cannot cross a state boundary.

interface Known {
  aId: string;
  aState: string;
  bId: string;
  bState: string;
  centreId: string;
}

const known: Known = { aId: "", aState: "", bId: "", bState: "", centreId: "" };

function ctxAssessor(userId: string, stateId: string): RlsContext {
  return { userId, role: "state_assessor", stateId };
}
function ctxCentre(userId: string): RlsContext {
  return { userId, role: "centre", stateId: null };
}

before(async () => {
  // Discover the seeded users' true ids via the ADMIN connection (bypasses RLS), so the
  // assertions below have ground truth to compare against.
  const q = await adminPool.query<{
    id: string;
    role: string;
    state_id: string | null;
    email: string;
  }>("SELECT id, role, state_id, email FROM users ORDER BY email");

  const a = q.rows.find((r) => r.email === "assessor.demo1@example.gov.in");
  const b = q.rows.find((r) => r.email === "assessor.demo2@example.gov.in");
  const c = q.rows.find((r) => r.email === "centre@njjm.gov.in");
  assert.ok(a && b && c, "Seed users must exist — run `npm run db:seed` first.");
  assert.ok(a!.state_id && b!.state_id, "Assessors must have states.");
  assert.notEqual(a!.state_id, b!.state_id, "Assessors must be in different states.");

  known.aId = a!.id;
  known.aState = a!.state_id!;
  known.bId = b!.id;
  known.bState = b!.state_id!;
  known.centreId = c!.id;
});

after(async () => {
  await pool.end();
  await adminPool.end();
});

test("app role is unprivileged (RLS actually applies)", async () => {
  await assertAppRoleIsUnprivileged();
});

test("assessor A cannot read assessor B's user row by id", async () => {
  const row = await getUserById(ctxAssessor(known.aId, known.aState), known.bId);
  assert.equal(row, null, "A must not be able to fetch B's row");
});

test("an unscoped SELECT as assessor A returns ONLY A (RLS, not the WHERE clause)", async () => {
  const rows = await listVisibleUsers(ctxAssessor(known.aId, known.aState));
  assert.equal(rows.length, 1, "A should see exactly one user row");
  assert.equal(rows[0]!.id, known.aId);
  assert.ok(!rows.some((r) => r.id === known.bId), "B must never appear");
});

test("assessor A can read its own row (positive control)", async () => {
  const row = await getUserById(ctxAssessor(known.aId, known.aState), known.aId);
  assert.ok(row, "A must be able to read itself");
  assert.equal(row!.id, known.aId);
});

test("assessor B symmetrically cannot read A", async () => {
  const rows = await listVisibleUsers(ctxAssessor(known.bId, known.bState));
  assert.equal(rows.length, 1);
  assert.equal(rows[0]!.id, known.bId);
});

test("the Centre role sees all users", async () => {
  const rows = await listVisibleUsers(ctxCentre(known.centreId));
  assert.ok(rows.length >= 3, "Centre should see every user");
  const ids = new Set(rows.map((r) => r.id));
  assert.ok(ids.has(known.aId) && ids.has(known.bId), "Centre sees both assessors");
});

test("the app role cannot touch the sessions table directly at all", async () => {
  await assert.rejects(
    () =>
      withRlsTx(ctxAssessor(known.aId, known.aState), (c) =>
        c.query("SELECT * FROM sessions"),
      ),
    /permission denied/i,
    "Direct access to sessions must be denied to the app role",
  );
});

test("states are readable anonymously (public reference data)", async () => {
  const states = await listStates();
  assert.equal(states.length, 36, "28 states + 8 UTs");
});
