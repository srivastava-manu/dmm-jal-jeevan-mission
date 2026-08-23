import { adminPool } from "../db/admin.js";
import { DATABASE_URL, ADMIN_DATABASE_URL } from "../config.js";

// Ensures the unprivileged app role exists with the right attributes and grants, using
// the credentials embedded in DATABASE_URL. Optionally (--reset) wipes the public schema
// so migrations re-run from scratch. The database itself is assumed to exist already
// (create it once with `createdb`, see DEVELOPMENT.md) — dropping the connected database
// from within is not possible.

const reset = process.argv.includes("--reset");

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

function q(v: string): string {
  return '"' + v.replace(/"/g, '""') + '"';
}
function lit(v: string): string {
  return "'" + v.replace(/'/g, "''") + "'";
}

async function main(): Promise<void> {
  const appUrl = new URL(DATABASE_URL);
  const appRole = decodeURIComponent(appUrl.username);
  const appPass = decodeURIComponent(appUrl.password);
  const dbName = decodeURIComponent(new URL(ADMIN_DATABASE_URL).pathname.replace(/^\//, ""));

  if (!IDENT.test(appRole)) {
    throw new Error(`Unsafe app role name in DATABASE_URL: ${appRole}`);
  }
  if (!appPass) {
    throw new Error("DATABASE_URL must include a password for the app role.");
  }

  const client = await adminPool.connect();
  try {
    // Create or update the app role — NON-superuser, NO bypassrls, so RLS applies to it.
    const exists = await client.query("SELECT 1 FROM pg_roles WHERE rolname = $1", [appRole]);
    if (exists.rowCount === 0) {
      await client.query(
        `CREATE ROLE ${q(appRole)} LOGIN PASSWORD ${lit(appPass)} ` +
          `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
      console.log(`Created role ${appRole}.`);
    } else {
      await client.query(
        `ALTER ROLE ${q(appRole)} LOGIN PASSWORD ${lit(appPass)} ` +
          `NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS`,
      );
      console.log(`Updated role ${appRole}.`);
    }

    if (reset) {
      await client.query("DROP SCHEMA public CASCADE");
      await client.query("CREATE SCHEMA public");
      console.log("Reset schema public.");
    }

    await client.query(`GRANT CONNECT ON DATABASE ${q(dbName)} TO ${q(appRole)}`);
    await client.query(`GRANT USAGE ON SCHEMA public TO ${q(appRole)}`);

    // The production database may be copied before the app role is created. In that case
    // migration-time GRANT statements do not attach to the newly-created role, so replay the
    // exact least-privilege grants here. Do not replace these with grants on all tables:
    // sessions are intentionally reachable only through their SECURITY DEFINER functions.
    const tableGrants = [
      ["states", "SELECT"],
      ["users", "SELECT, INSERT, UPDATE, DELETE"],
      ["model_versions", "SELECT"],
      ["capabilities", "SELECT"],
      ["assessments", "SELECT, INSERT, UPDATE, DELETE"],
      ["scores", "SELECT, INSERT, UPDATE"],
      ["systems", "SELECT, INSERT, UPDATE, DELETE"],
      ["score_evidence", "SELECT, INSERT, UPDATE"],
      ["audit_log", "SELECT, INSERT"],
      ["support_requests", "SELECT, INSERT, UPDATE"],
    ] as const;
    let grantedTables = 0;
    for (const [table, privileges] of tableGrants) {
      const { rows } = await client.query<{ relation: string | null }>(
        "SELECT to_regclass($1) AS relation",
        [`public.${table}`],
      );
      if (!rows[0]?.relation) continue;
      await client.query(`GRANT ${privileges} ON TABLE ${q(table)} TO ${q(appRole)}`);
      grantedTables += 1;
    }

    const functionGrants = [
      "auth_lookup_by_email(text)",
      "session_create(uuid, numeric)",
      "session_resolve(uuid)",
      "session_destroy(uuid)",
      "move_state_assessments(uuid, uuid)",
    ] as const;
    let grantedFunctions = 0;
    for (const fn of functionGrants) {
      const { rows } = await client.query<{ routine: string | null }>(
        "SELECT to_regprocedure($1) AS routine",
        [fn],
      );
      if (!rows[0]?.routine) continue;
      await client.query(`GRANT EXECUTE ON FUNCTION ${fn} TO ${q(appRole)}`);
      grantedFunctions += 1;
    }

    console.log(
      `Granted app role database/schema access plus privileges on ${grantedTables} table(s) ` +
        `and ${grantedFunctions} function(s) to ${appRole}.`,
    );
    console.log("DB setup complete.");
  } finally {
    client.release();
    await adminPool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
