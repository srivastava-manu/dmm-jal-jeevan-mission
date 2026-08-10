import pg from "pg";
import { DATABASE_URL } from "../config.js";

// The single application pool. This is the ONLY connection the request path uses, and
// it authenticates as the unprivileged `dmm_app` role so row-level security is enforced.
export const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

/**
 * Startup guard. RLS is silently bypassed for superusers and roles with BYPASSRLS, so a
 * misconfigured DATABASE_URL pointing at a privileged role would disable every isolation
 * guarantee without any error. We refuse to serve in that case.
 */
export async function assertAppRoleIsUnprivileged(): Promise<void> {
  const { rows } = await pool.query<{
    rolsuper: boolean;
    rolbypassrls: boolean;
    who: string;
  }>(
    `SELECT rolsuper, rolbypassrls, current_user AS who
       FROM pg_roles WHERE rolname = current_user`,
  );
  const row = rows[0];
  if (!row) throw new Error("Could not determine the current database role.");
  if (row.rolsuper || row.rolbypassrls) {
    throw new Error(
      `Refusing to start: the app DB role "${row.who}" is superuser or has BYPASSRLS, ` +
        `so row-level security would NOT be enforced. Point DATABASE_URL at a ` +
        `non-privileged role (e.g. dmm_app).`,
    );
  }
}

export async function closePool(): Promise<void> {
  await pool.end();
}
