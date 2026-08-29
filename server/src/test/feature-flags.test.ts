import { test, after } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";

import { requireFeature } from "../http/feature-gate.js";

// A disabled feature must be indistinguishable from one that was never built: 404 for every
// caller, before any authentication or role check. These tests build their own tiny app so
// they assert the gate's behaviour deterministically, whatever FEATURE_* the ambient
// environment happens to set. (The real routes are covered by access-matrix.test.ts, which
// adapts its expectations to the current flag.)

const servers: Server[] = [];

function appWithGate(enabled: boolean) {
  const app = express();
  app.use(express.json());
  app.use("/gated", requireFeature(enabled));
  app.get("/gated/thing", (_req, res) => res.json({ ok: true }));
  app.post("/gated/thing", (_req, res) => res.status(201).json({ ok: true }));
  app.get("/open/thing", (_req, res) => res.json({ ok: true }));
  return app;
}

async function listen(app: express.Express): Promise<string> {
  const server = app.listen(0);
  servers.push(server);
  await new Promise((r) => server.once("listening", r));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

after(async () => {
  for (const s of servers) {
    s.closeAllConnections();
    await new Promise((r) => s.close(r));
  }
});

test("a disabled feature returns 404 — not 403 — so it never advertises itself", async () => {
  const base = await listen(appWithGate(false));
  for (const [method, path] of [
    ["GET", "/gated/thing"],
    ["POST", "/gated/thing"],
  ] as const) {
    const res = await fetch(base + path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: method === "POST" ? "{}" : undefined,
    });
    assert.equal(res.status, 404, `${method} ${path} should be 404 while disabled`);
    // 403 would confirm the endpoint exists; 404 must not.
    assert.notEqual(res.status, 403);
  }
});

test("a disabled feature does not affect neighbouring routes", async () => {
  const base = await listen(appWithGate(false));
  const res = await fetch(base + "/open/thing");
  assert.equal(res.status, 200);
});

test("an enabled feature passes straight through", async () => {
  const base = await listen(appWithGate(true));
  assert.equal((await fetch(base + "/gated/thing")).status, 200);
  assert.equal(
    (await fetch(base + "/gated/thing", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" })).status,
    201,
  );
});
