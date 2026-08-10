import type { PoolClient } from "pg";
import { pool } from "./pool.js";

export type Role = "state_assessor" | "centre";

/** The security context the request carries into every data query. */
export interface RlsContext {
  userId: string;
  role: Role;
  stateId: string | null;
}

/**
 * Run `fn` inside a transaction whose `app.*` session variables carry the caller's
 * identity, which the RLS policies read via current_setting().
 *
 * Pass `null` for an anonymous context (public reads such as states / the About page).
 *
 * The variables are set with set_config(..., is_local => true), so they are scoped to
 * THIS transaction and reset on COMMIT/ROLLBACK. Using a transaction per unit of work is
 * what prevents SET values from leaking between pooled connections — the single most
 * important detail when doing RLS without a hosted platform.
 */
export async function withRlsTx<T>(
  ctx: RlsContext | null,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT set_config('app.user_id', $1, true)", [ctx?.userId ?? ""]);
    await client.query("SELECT set_config('app.role', $1, true)", [ctx?.role ?? ""]);
    await client.query("SELECT set_config('app.state_id', $1, true)", [ctx?.stateId ?? ""]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
