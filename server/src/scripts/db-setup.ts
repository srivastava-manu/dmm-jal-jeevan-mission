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
    console.log(`Granted CONNECT + schema USAGE to ${appRole}.`);
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
