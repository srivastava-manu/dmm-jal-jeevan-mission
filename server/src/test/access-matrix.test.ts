import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";

import { createApp } from "../http/app.js";
import { adminPool } from "../db/admin.js";
import { pool } from "../db/pool.js";
import { sessionCreate } from "../db/index.js";
import { session as sessionCfg, features } from "../config.js";

// The access-control matrix: for every API route, hit it as a same-state assessor (A), an
// other-state assessor (B), a Centre user, and anonymous, and assert the status for all four.
// Sessions are minted directly (bypassing login + the rate limiter); RLS still applies because
// each session carries its real role/state.

let server: Server;
let base = "";

const ids = {
  stateA: "", stateB: "", stateC: "", stateD: "",
  userA: "", userB: "", centre: "", userDel: "",
  submittedA1: "", submittedA2: "", draftA: "",
  systemA: "", reqA: "", capId: "",
  sessA: "", sessB: "", sessC: "",
};

async function hit(method: string, path: string, cookie: string | null, body?: unknown): Promise<number> {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: `${sessionCfg.cookieName}=${cookie}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.status;
}

async function cleanup() {
  const scoped = "SELECT state_id FROM users WHERE email LIKE 'am%@test.local'";
  await adminPool.query(`DELETE FROM support_requests WHERE state_id IN (${scoped})`);
  await adminPool.query(`DELETE FROM systems WHERE state_id IN (${scoped})`);
  await adminPool.query(`DELETE FROM assessments WHERE state_id IN (${scoped})`);
  await adminPool.query("DELETE FROM audit_log WHERE actor_user_id IN (SELECT id FROM users WHERE email LIKE 'am%@test.local')");
  await adminPool.query("DELETE FROM users WHERE email LIKE 'am%@test.local'");
}

before(async () => {
  await cleanup(); // in case a previous run left fixtures behind
  // Two assessor-less states for A/B, plus a throwaway state C for destructive Centre writes.
  const states = await adminPool.query<{ id: string }>(
    `SELECT id FROM states
     WHERE id NOT IN (SELECT state_id FROM users WHERE role='state_assessor' AND active AND state_id IS NOT NULL)
     ORDER BY name LIMIT 4`,
  );
  ids.stateA = states.rows[0]!.id;
  ids.stateB = states.rows[1]!.id;
  ids.stateC = states.rows[2]!.id;
  ids.stateD = states.rows[3]!.id;
  const mv = (await adminPool.query<{ id: string }>("SELECT id FROM model_versions ORDER BY published_at DESC LIMIT 1")).rows[0]!.id;
  ids.capId = (await adminPool.query<{ id: string }>("SELECT id FROM capabilities WHERE model_version_id=$1 ORDER BY layer_index,order_in_layer LIMIT 1", [mv])).rows[0]!.id;

  const mkUser = async (email: string, role: string, state: string | null) =>
    (await adminPool.query<{ id: string }>(
      "INSERT INTO users (email,name,role,state_id,active) VALUES ($1,$2,$3,$4,true) RETURNING id",
      [email, email, role, state],
    )).rows[0]!.id;
  ids.userA = await mkUser("am_a@test.local", "state_assessor", ids.stateA);
  ids.userB = await mkUser("am_b@test.local", "state_assessor", ids.stateB);
  ids.centre = await mkUser("am_c@test.local", "centre", null);

  const mkAssessment = async (status: string, extra: string) =>
    (await adminPool.query<{ id: string }>(
      `INSERT INTO assessments (state_id, model_version_id, status ${status === "submitted" ? ", assessor_name, submitted_at, locked_at" : ""})
       VALUES ($1,$2,'${status}' ${extra}) RETURNING id`,
      [ids.stateA, mv],
    )).rows[0]!.id;
  ids.submittedA1 = await mkAssessment("submitted", ", 'A', now() - interval '2 days', now() + interval '5 days'");
  ids.submittedA2 = await mkAssessment("submitted", ", 'A', now() - interval '9 days', now() - interval '2 days'");
  ids.draftA = await mkAssessment("draft", "");
  await adminPool.query("INSERT INTO scores (assessment_id, capability_id, value) VALUES ($1,$2,2)", [ids.submittedA1, ids.capId]);

  ids.systemA = (await adminPool.query<{ id: string }>(
    "INSERT INTO systems (state_id, name) VALUES ($1,'AM System') RETURNING id", [ids.stateA],
  )).rows[0]!.id;
  ids.reqA = (await adminPool.query<{ id: string }>(
    "INSERT INTO support_requests (state_id, capability_id, message) VALUES ($1,$2,'help') RETURNING id",
    [ids.stateA, ids.capId],
  )).rows[0]!.id;

  // A throwaway assessor with no assessments, so DELETE /api/centre/assessors/:id can be
  // exercised without hitting the "has submitted assessments" 409 guard.
  ids.userDel = await mkUser("am_del@test.local", "state_assessor", ids.stateD);

  ids.sessA = (await sessionCreate(ids.userA, 1)).id;
  ids.sessB = (await sessionCreate(ids.userB, 1)).id;
  ids.sessC = (await sessionCreate(ids.centre, 1)).id;

  server = createApp().listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
  await cleanup();
  await pool.end();
  await adminPool.end();
});

// Support requests are an optional feature. When it is off the routes must 404 for EVERY
// actor; when on, normal role/RLS rules apply. Expressing it this way keeps the matrix
// correct under either setting — and `npm run test:access` turns the feature on so the
// support_requests RLS policies stay exercised even while the feature is dormant.
const SR = features.supportRequests;
const sr = (whenOn: readonly [number, number, number, number]) =>
  (SR ? whenOn : [404, 404, 404, 404]) as unknown as readonly [number, number, number, number];

// Each row: [method, path, body, [expectA, expectB, expectCentre, expectAnon]]. GET routes
// listed before the mutations that would change the fixtures they read.
function routes() {
  return [
    // Public
    ["GET", "/api/health", undefined, [200, 200, 200, 200]],
    ["GET", "/api/model", undefined, [200, 200, 200, 200]],
    ["GET", "/api/states", undefined, [200, 200, 200, 200]],
    ["GET", "/api/auth/me", undefined, [200, 200, 200, 401]],
    // State-assessor collections (Centre is wrong role -> 403; anon -> 401)
    ["GET", "/api/assessments", undefined, [200, 200, 403, 401]],
    ["GET", "/api/systems", undefined, [200, 200, 403, 401]],
    ["GET", "/api/requests", undefined, sr([200, 200, 403, 401])],
    // Assessment detail (state_assessor only): other-state hidden by RLS -> 404
    ["GET", `/api/assessments/${ids.submittedA1}`, undefined, [200, 404, 403, 401]],
    // Read routes (requireAuth): Centre may read submitted; other-state -> 404
    ["GET", `/api/assessments/${ids.submittedA1}/results`, undefined, [200, 404, 200, 401]],
    ["GET", `/api/assessments/${ids.submittedA1}/history`, undefined, [200, 404, 200, 401]],
    ["GET", `/api/assessments/${ids.submittedA1}/compare?to=${ids.submittedA2}`, undefined, [200, 404, 200, 401]],
    // A DRAFT: owner sees it, Centre must NOT (draft invisible), other-state -> 404
    ["GET", `/api/assessments/${ids.draftA}/results`, undefined, [200, 404, 404, 401]],
    // Review is state_assessor-only (Centre is the wrong role -> 403, not 404)
    ["GET", `/api/assessments/${ids.draftA}/review`, undefined, [200, 404, 403, 401]],
    // Centre routes (Centre only)
    ["GET", "/api/centre/dashboard", undefined, [403, 403, 200, 401]],
    ["GET", "/api/centre/assessors", undefined, [403, 403, 200, 401]],
    ["GET", "/api/centre/requests", undefined, sr([403, 403, 200, 401])],
    ["GET", "/api/centre/audit", undefined, [403, 403, 200, 401]],
    ["GET", "/api/centre/export.csv", undefined, [403, 403, 200, 401]],
    ["GET", "/api/centre/capability-stat?name=Feedback%20%26%20Satisfaction", undefined, sr([403, 403, 200, 401])],
    // State-assessor writes
    ["PUT", `/api/assessments/${ids.draftA}/scores/${ids.capId}`, { value: 2 }, [200, 403, 403, 401]],
    // Evidence link (the score row above must exist first). B is refused by RLS -> 403.
    ["PUT", `/api/assessments/${ids.draftA}/scores/${ids.capId}/evidence`, { system_id: null }, [200, 403, 403, 401]],
    ["POST", "/api/systems", { name: "am-new-system" }, [201, 201, 403, 401]],
    ["PATCH", `/api/systems/${ids.systemA}`, { name: "AM System v2" }, [200, 404, 403, 401]],
    ["POST", "/api/requests", { capabilityId: ids.capId, message: "hi" }, sr([201, 201, 403, 401])],
    // Centre writes (reassign/add target throwaway state C; reset targets userB)
    ["PATCH", `/api/centre/assessors/${ids.userA}`, { active: true }, [403, 403, 200, 401]],
    ["PATCH", `/api/centre/requests/${ids.reqA}`, { status: "in_progress" }, sr([403, 403, 200, 401])],
    ["POST", "/api/centre/assessors", { stateId: ids.stateC, name: "New", email: "amc_new@test.local" }, [403, 403, 201, 401]],
    ["POST", "/api/centre/reassign", { stateId: ids.stateC, name: "Re", email: "amc_re@test.local" }, [403, 403, 200, 401]],
    ["POST", `/api/centre/assessors/${ids.userB}/reset-password`, {}, [403, 403, 200, 401]],
    // Destructive last, in dependency order.
    ["DELETE", `/api/systems/${ids.systemA}`, undefined, [200, 404, 403, 401]],
    // Centre deletes a throwaway assessor (no assessments, so no 409 guard).
    ["DELETE", `/api/centre/assessors/${ids.userDel}`, undefined, [403, 403, 200, 401]],
    // Submit A's draft: A is authorised but the draft is incomplete -> 409. B cannot even
    // see it (RLS) -> the route reports it as a bad request. Neither B nor Centre can submit.
    ["POST", `/api/assessments/${ids.draftA}/submit`, {}, [409, 400, 403, 401]],
    // Delete the draft (A succeeds; afterwards it is gone, so B sees 404).
    ["DELETE", `/api/assessments/${ids.draftA}`, undefined, [200, 404, 403, 401]],
    // Re-create a draft: each assessor may start one for their OWN state only.
    ["POST", "/api/assessments", { mode: "blank" }, [201, 201, 403, 401]],
    // ABSOLUTELY LAST: logout destroys each actor's session, so no row may follow it.
    // Idempotent by design — anonymous logout is a no-op, not an error.
    ["POST", "/api/auth/logout", {}, [200, 200, 200, 200]],
  ] as const;
}

test("every route enforces same-state / other-state / Centre / anonymous access", async () => {
  const actors: [string, string | null][] = [
    ["A(same-state)", ids.sessA],
    ["B(other-state)", ids.sessB],
    ["Centre", ids.sessC],
    ["anon", null],
  ];
  const failures: string[] = [];
  for (const [method, path, body, expected] of routes()) {
    for (let i = 0; i < actors.length; i++) {
      const [label, cookie] = actors[i]!;
      const status = await hit(method, path, cookie, body);
      if (status !== expected[i]) {
        failures.push(`${method} ${path} as ${label}: expected ${expected[i]}, got ${status}`);
      }
    }
  }
  assert.equal(failures.length, 0, "\n" + failures.join("\n"));
});
