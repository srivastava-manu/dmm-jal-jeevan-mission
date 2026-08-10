import fs from "node:fs/promises";
import path from "node:path";
import { adminPool } from "../db/admin.js";
import { REPO_ROOT } from "../config.js";

// Applies every migrations/NNN_*.sql not yet recorded in schema_migrations, in order,
// each in its own transaction. Plain SQL files, checked into the repo, so NIC can see
// exactly what runs against their database.
const MIGRATIONS_DIR = path.join(REPO_ROOT, "migrations");

async function main(): Promise<void> {
  const client = await adminPool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        filename   text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    const appliedRes = await client.query<{ filename: string }>(
      "SELECT filename FROM schema_migrations",
    );
    const applied = new Set(appliedRes.rows.map((r) => r.filename));

    const files = (await fs.readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith(".sql"))
      .sort();

    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = await fs.readFile(path.join(MIGRATIONS_DIR, file), "utf8");
      process.stdout.write(`Applying ${file} ... `);
      await client.query("BEGIN");
      try {
        await client.query(sql);
        await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [file]);
        await client.query("COMMIT");
        console.log("ok");
        ran++;
      } catch (err) {
        await client.query("ROLLBACK");
        console.log("FAILED");
        throw err;
      }
    }
    console.log(ran === 0 ? "No new migrations." : `Applied ${ran} migration(s).`);
  } finally {
    client.release();
    await adminPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
