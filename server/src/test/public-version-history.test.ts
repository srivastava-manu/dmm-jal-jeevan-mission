import { test, before, after } from "node:test";
import assert from "node:assert/strict";

import { adminPool } from "../db/admin.js";
import { getPublicModel } from "../db/index.js";

// The About page's version history is public. A version is listed ONLY when someone has
// written public_notes for it — the deliberate act of describing the change to a state
// official. Two things must hold, and neither is obvious from reading the query:
//
//   1. A version with NULL public_notes never reaches the page, however it got into the
//      table. (seed-compare-demo.ts inserts a fabricated v2.0 for the compare screen; a
//      public page asserting that release happened would be a false claim.)
//   2. The internal `notes` column never leaks — it carries provenance like "Imported from
//      dmm-model.js", written for maintainers, not citizens.

const PRIVATE = "zz-public-history-private";
const PUBLIC = "zz-public-history-public";
const PRIVATE_INTERNAL_NOTE = "INTERNAL ONLY — must never appear on the public page.";

async function cleanup() {
  await adminPool.query("DELETE FROM model_versions WHERE version LIKE 'zz-public-history%'");
}

before(async () => {
  await cleanup();
  // Both dated in the past so neither becomes the current version — the current version is
  // listed unconditionally, which would mask the filter we are testing.
  await adminPool.query(
    `INSERT INTO model_versions (version, published_at, notes, public_notes) VALUES
       ($1, now() - interval '10 years', $3, NULL),
       ($2, now() - interval '9 years',  'internal', 'A real published change.')`,
    [PRIVATE, PUBLIC, PRIVATE_INTERNAL_NOTE],
  );
});

after(cleanup);

test("a version without public_notes is not listed", async () => {
  const model = await getPublicModel();
  assert.ok(model);
  const listed = model.versions.map((v) => v.version);
  assert.ok(!listed.includes(PRIVATE), `${PRIVATE} must be hidden, got ${listed.join(", ")}`);
  assert.ok(listed.includes(PUBLIC), `${PUBLIC} has public_notes and must be listed`);
});

test("the internal notes column never reaches the public payload", async () => {
  const model = await getPublicModel();
  assert.ok(model);
  const serialised = JSON.stringify(model);
  assert.ok(
    !serialised.includes(PRIVATE_INTERNAL_NOTE),
    "internal provenance notes leaked into the public model payload",
  );
});

test("the current version is listed even with no public note written yet", async () => {
  const current = (
    await adminPool.query<{ id: string; version: string; public_notes: string | null }>(
      "SELECT id, version, public_notes FROM model_versions ORDER BY published_at DESC LIMIT 1",
    )
  ).rows[0]!;

  // Temporarily blank the current version's public note, then restore it.
  await adminPool.query("UPDATE model_versions SET public_notes = NULL WHERE id = $1", [current.id]);
  try {
    const model = await getPublicModel();
    assert.ok(model);
    assert.equal(model.version, current.version);
    const row = model.versions.find((v) => v.version === current.version);
    assert.ok(row, "the version in force must always be listed");
    assert.equal(row.notes, null, "with no public note it carries none — the UI supplies the fallback");
  } finally {
    await adminPool.query("UPDATE model_versions SET public_notes = $2 WHERE id = $1", [
      current.id,
      current.public_notes,
    ]);
  }
});
