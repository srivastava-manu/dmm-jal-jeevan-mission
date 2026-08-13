import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { adminPool } from "../db/admin.js";
import { pool } from "../db/pool.js";
import { getReadAssessment, getCapScoresForRead } from "../db/index.js";
import { computeResults, type CapScore } from "../lib/scoring.js";
import type { RlsContext } from "../db/rls.js";

// Bumping MODEL_VERSION must never mutate a submitted assessment. We snapshot an assessment's
// results, publish a NEW (later) model version, and confirm the old assessment still resolves
// against its OWN version — identical scores, capabilities and overall score.

const centre: RlsContext = { userId: "00000000-0000-0000-0000-000000000000", role: "centre", stateId: null };

let oldMv = "";
let newMv = "";
let assessmentId = "";
let beforeScore = 0;

const toCap = (r: { capability_id: string; layer_index: number; layer_name: string; order_in_layer: number; name: string; value: number | null }): CapScore => ({
  capability_id: r.capability_id, layer_index: r.layer_index, layer_name: r.layer_name,
  order_in_layer: r.order_in_layer, name: r.name, value: r.value,
});

async function dropTestVersion() {
  await adminPool.query("DELETE FROM capabilities WHERE model_version_id IN (SELECT id FROM model_versions WHERE version LIKE 'zz-integrity%')");
  await adminPool.query("DELETE FROM model_versions WHERE version LIKE 'zz-integrity%'");
}

before(async () => {
  await dropTestVersion(); // in case a prior run left the test version behind
  oldMv = (await adminPool.query<{ id: string }>("SELECT id FROM model_versions WHERE version NOT LIKE 'zz-integrity%' ORDER BY published_at DESC LIMIT 1")).rows[0]!.id;
  const state = (await adminPool.query<{ id: string }>("SELECT id FROM states ORDER BY name LIMIT 1")).rows[0]!.id;

  assessmentId = (
    await adminPool.query<{ id: string }>(
      `INSERT INTO assessments (state_id, model_version_id, status, assessor_name, submitted_at, locked_at)
       VALUES ($1,$2,'submitted','Integrity',now(),now()+interval '7 days') RETURNING id`,
      [state, oldMv],
    )
  ).rows[0]!.id;
  // Score every capability of the old version (deterministic 0..4).
  await adminPool.query(
    `INSERT INTO scores (assessment_id, capability_id, value)
     SELECT $1, id, LEAST(order_in_layer, 4) FROM capabilities WHERE model_version_id = $2`,
    [assessmentId, oldMv],
  );

  const caps = await getCapScoresForRead(centre, assessmentId, oldMv);
  beforeScore = computeResults(caps.map(toCap)).overallScore;
});

after(async () => {
  await adminPool.query("DELETE FROM assessments WHERE id = $1", [assessmentId]);
  await dropTestVersion();
  await pool.end();
  await adminPool.end();
});

test("publishing a new model version does not mutate a submitted assessment", async () => {
  // Publish a brand-new, later version with its own capabilities (a MODEL_VERSION bump).
  newMv = (
    await adminPool.query<{ id: string }>(
      `INSERT INTO model_versions (version, published_at, notes)
       VALUES ('zz-integrity-9.9', now() + interval '1 day', 'test') RETURNING id`,
    )
  ).rows[0]!.id;
  await adminPool.query(
    `INSERT INTO capabilities (model_version_id, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes)
     SELECT $1, layer_index, layer_name, layer_covers, order_in_layer, name, measure, includes
     FROM capabilities WHERE model_version_id = $2`,
    [newMv, oldMv],
  );

  // The assessment still points at its OWN version, and its scores are untouched.
  const a = await getReadAssessment(centre, assessmentId);
  assert.ok(a);
  assert.equal(a!.model_version_id, oldMv, "assessment must still resolve against its own version");

  const caps = await getCapScoresForRead(centre, assessmentId, a!.model_version_id);
  // Every capability belongs to the OLD version (not the newly published one).
  const capIds = new Set(caps.map((c) => c.capability_id));
  const oldCapIds = (
    await adminPool.query<{ id: string }>("SELECT id FROM capabilities WHERE model_version_id = $1", [oldMv])
  ).rows.map((r) => r.id);
  assert.ok(oldCapIds.every((id) => capIds.has(id)), "results use the old version's capabilities");

  const afterScore = computeResults(caps.map(toCap)).overallScore;
  assert.equal(afterScore, beforeScore, "overall score unchanged after the version bump");
});
