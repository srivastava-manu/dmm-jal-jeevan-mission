#!/usr/bin/env node
// Keeps package-lock.json portable across environments.
//
// Replit installs packages through an internal proxy and records ITS host in the lockfile's
// "resolved" fields (http://package-firewall.replit.local/npm/...). That host resolves only
// inside Replit, so a lockfile carrying those URLs makes `npm install` fail everywhere else
// with ENOTFOUND — local development, CI, and any future NIC deployment.
//
// This runs as `postinstall`, so whichever environment installs, the lockfile is rewritten
// back to the public registry immediately afterwards and the committed file stays portable.
// It deliberately does NOT change which registry npm fetches FROM: Replit keeps using its
// proxy (which is what makes installs work there); only the recorded URL is normalised.
//
// Rewriting the host is safe: the paths are identical to npm's and the integrity hashes
// describe the tarball contents, not its location — so versions and integrity are unchanged.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_REGISTRY = "https://registry.npmjs.org/";
// Any private/proxy host that npm might record instead of the public registry.
const PRIVATE_HOST = /https?:\/\/[^/"]*package-firewall\.replit\.local\/npm\//g;

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const lockPath = path.join(root, "package-lock.json");

try {
  const original = await readFile(lockPath, "utf8");
  const normalised = original.replace(PRIVATE_HOST, PUBLIC_REGISTRY);
  if (normalised === original) process.exit(0); // nothing to do — the common case

  // Parse before writing: never leave a corrupt lockfile behind.
  JSON.parse(normalised);
  await writeFile(lockPath, normalised);
  const count = (original.match(PRIVATE_HOST) ?? []).length;
  console.log(`normalize-lockfile: rewrote ${count} private registry URL(s) to ${PUBLIC_REGISTRY}`);
} catch (err) {
  // Never fail an install because of this — it is hygiene, not a build step.
  if (err && err.code !== "ENOENT") {
    console.warn("normalize-lockfile: skipped —", err.message);
  }
}
