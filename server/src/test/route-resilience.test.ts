import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";

import { createApp } from "../http/app.js";
import { pool } from "../db/pool.js";
import { adminPool } from "../db/admin.js";

// Express 4 does not catch rejected promises from async handlers — an unhandled rejection
// used to kill the whole process (a malformed uuid reaching Postgres was enough to log every
// user out). asyncRouter() now forwards rejections to the error middleware.
//
// This test drives every route with hostile input on a REAL server, then asserts the server
// is still answering. It deliberately does NOT install process-level handlers, so a
// regression here shows up as a failed run rather than a silently-swallowed crash.

let server: Server;
let base = "";
let cookie = "";

async function req(
  method: string,
  path: string,
  opts: { body?: unknown; auth?: boolean } = {},
): Promise<{ status: number }> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth && cookie) headers["Cookie"] = cookie;
  const res = await fetch(`${base}${path}`, {
    method,
    headers,
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status };
}

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://127.0.0.1:${port}`;

  // Sign in as a state assessor so authenticated routes are actually exercised.
  const seeded = await adminPool.query<{ email: string }>(
    "SELECT email FROM users WHERE role = 'state_assessor' AND active ORDER BY email LIMIT 1",
  );
  const email = seeded.rows[0]?.email;
  if (email) {
    const res = await fetch(`${base}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // No hardcoded fallback: the password comes from the environment or the sign-in simply
      // fails, and the test still runs its hostile requests anonymously.
      body: JSON.stringify({ email, password: process.env.SEED_ASSESSOR_PASSWORD ?? "" }),
    });
    const setCookie = res.headers.get("set-cookie");
    if (setCookie) cookie = setCookie.split(";")[0]!;
  }
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  await adminPool.end();
});

const BAD_ID = "not-a-uuid";

// (method, path, body) — every route, driven with a malformed id and/or junk body.
const HOSTILE: [string, string, unknown?][] = [
  ["GET", `/api/assessments/${BAD_ID}`],
  ["GET", `/api/assessments/${BAD_ID}/review`],
  ["GET", `/api/assessments/${BAD_ID}/results`],
  ["GET", `/api/assessments/${BAD_ID}/history`],
  ["GET", `/api/assessments/${BAD_ID}/compare`],
  ["GET", `/api/assessments/${BAD_ID}/compare?to=${BAD_ID}`],
  ["POST", `/api/assessments/${BAD_ID}/submit`, {}],
  ["DELETE", `/api/assessments/${BAD_ID}`],
  ["POST", "/api/assessments", { mode: "nonsense" }],
  ["PUT", `/api/assessments/${BAD_ID}/scores/${BAD_ID}`, { value: 2 }],
  ["PUT", `/api/assessments/${BAD_ID}/scores/${BAD_ID}/evidence`, { system_id: null }],
  ["POST", "/api/systems", { name: "Bad date", go_live: "not-a-date" }],
  ["POST", "/api/systems", { name: "Bad districts", districts_live: "many" }],
  ["PATCH", `/api/systems/${BAD_ID}`, { name: "X" }],
  ["DELETE", `/api/systems/${BAD_ID}`],
  ["POST", "/api/requests", { capabilityId: BAD_ID, message: "hi" }],
  ["GET", "/api/centre/capability-stat?name=Nope"],
  ["PATCH", `/api/centre/requests/${BAD_ID}`, { status: "closed" }],
  ["PATCH", `/api/centre/assessors/${BAD_ID}`, { active: false }],
  ["DELETE", `/api/centre/assessors/${BAD_ID}`],
  ["POST", `/api/centre/assessors/${BAD_ID}/reset-password`, {}],
  ["POST", "/api/centre/reassign", { stateId: BAD_ID, name: "X", email: "x@y.gov.in" }],
  ["GET", "/api/model"],
  ["GET", "/api/states"],
];

test("no route can crash the server with malformed input", async () => {
  for (const [method, path, body] of HOSTILE) {
    const { status } = await req(method, path, { body, auth: true });
    // Any HTTP answer is fine (400/403/404/409/500). What must NOT happen is the process
    // dying — which would surface as a failed fetch below.
    assert.ok(status >= 200 && status < 600, `${method} ${path} returned ${status}`);

    // After each hostile call the server must still answer a normal request.
    const health = await req("GET", "/api/health");
    assert.equal(health.status, 200, `server died after ${method} ${path}`);
  }
});

test("malformed uuid returns an error status, not a crash", async () => {
  const { status } = await req("GET", `/api/assessments/${BAD_ID}`, { auth: true });
  assert.ok(status >= 400, `expected an error status, got ${status}`);
  const health = await req("GET", "/api/health");
  assert.equal(health.status, 200);
});
