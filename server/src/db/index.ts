import { withRlsTx, type RlsContext, type Role } from "./rls.js";

// ─────────────────────────────────────────────────────────────────────────────
// The ONLY module that writes SQL. Route handlers call these scoped functions and
// never build queries themselves, so the data-isolation rules are reviewable in one
// place. Everything state-scoped runs through withRlsTx; the RLS policies (not this
// code) are the real guarantee.
// ─────────────────────────────────────────────────────────────────────────────

export interface DbUser {
  id: string;
  email: string;
  name: string;
  designation: string | null;
  role: Role;
  state_id: string | null;
  active: boolean;
  created_at: string;
}

export interface AuthUserRow extends DbUser {
  password_hash: string;
}

const USER_COLS =
  "id, email, name, designation, role, state_id, active, created_at";

// ── Auth (pre-context; via SECURITY DEFINER function) ────────────────────────

/** Look up a user by email for credential verification. Runs with no app.* context. */
export async function authLookupByEmail(email: string): Promise<AuthUserRow | null> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<AuthUserRow>(
      "SELECT * FROM auth_lookup_by_email($1)",
      [email],
    );
    return rows[0] ?? null;
  });
}

// ── Sessions (via SECURITY DEFINER functions) ────────────────────────────────

export async function sessionCreate(
  userId: string,
  ttlHours: number,
): Promise<{ id: string; expires_at: string }> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<{ id: string; expires_at: string }>(
      "SELECT id, expires_at FROM session_create($1, $2)",
      [userId, ttlHours],
    );
    if (!rows[0]) throw new Error("session_create returned no row");
    return rows[0];
  });
}

export interface ResolvedSession {
  session_id: string;
  user_id: string;
  role: Role;
  state_id: string | null;
  name: string;
  email: string;
  designation: string | null;
  expires_at: string;
}

export async function sessionResolve(
  sessionId: string,
): Promise<ResolvedSession | null> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<ResolvedSession>(
      "SELECT * FROM session_resolve($1)",
      [sessionId],
    );
    return rows[0] ?? null;
  });
}

export async function sessionDestroy(sessionId: string): Promise<void> {
  await withRlsTx(null, async (c) => {
    await c.query("SELECT session_destroy($1)", [sessionId]);
  });
}

// ── Users (RLS-scoped by the caller's context) ───────────────────────────────

export async function getUserById(
  ctx: RlsContext,
  id: string,
): Promise<DbUser | null> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<DbUser>(
      `SELECT ${USER_COLS} FROM users WHERE id = $1`,
      [id],
    );
    return rows[0] ?? null;
  });
}

/**
 * Intentionally unscoped `SELECT ... FROM users` (no WHERE). It returns only the rows
 * the caller's RLS context is permitted to see — used by the isolation test to prove
 * that a buggy/hostile query still cannot cross state boundaries.
 */
export async function listVisibleUsers(ctx: RlsContext): Promise<DbUser[]> {
  return withRlsTx(ctx, async (c) => {
    const { rows } = await c.query<DbUser>(`SELECT ${USER_COLS} FROM users`);
    return rows;
  });
}

// ── States (public reference data) ───────────────────────────────────────────

export interface DbState {
  id: string;
  name: string;
  is_ut: boolean;
}

export async function listStates(): Promise<DbState[]> {
  return withRlsTx(null, async (c) => {
    const { rows } = await c.query<DbState>(
      "SELECT id, name, is_ut FROM states ORDER BY name",
    );
    return rows;
  });
}
