import assert from "node:assert/strict";
import test, { after, before } from "node:test";
import type { Server } from "node:http";
import { createApp } from "../http/app.js";
import { seed } from "../config.js";
import { pool } from "../db/pool.js";
import { adminPool } from "../db/admin.js";

let server: Server;
let base = "";

before(async () => {
  assert.ok(seed.centrePassword, "SEED_CENTRE_PASSWORD must be configured for seeded login tests.");
  assert.ok(seed.assessorPassword, "SEED_ASSESSOR_PASSWORD must be configured for seeded login tests.");

  const app = createApp();
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  base = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await pool.end();
  await adminPool.end();
});

async function signIn(email: string, password: string): Promise<Response> {
  return fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
}

test("seeded Centre account signs in to the national dashboard", async () => {
  const response = await signIn("centre@njjm.gov.in", seed.centrePassword);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { user: { role: string }; redirect: string };
  assert.equal(body.user.role, "centre");
  assert.equal(body.redirect, "/dashboard");
});

test("seeded state assessor signs in to the assessment home", async () => {
  const response = await signIn("assessor.demo1@example.gov.in", seed.assessorPassword);
  assert.equal(response.status, 200);

  const body = (await response.json()) as { user: { role: string }; redirect: string };
  assert.equal(body.user.role, "state_assessor");
  assert.equal(body.redirect, "/home");
});