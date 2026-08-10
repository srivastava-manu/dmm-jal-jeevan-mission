-- 002_users_sessions.sql
-- Users, server-side sessions, and the SECURITY DEFINER functions that perform the two
-- operations which legitimately run BEFORE an authenticated app.* context exists:
-- looking a user up by email at login, and resolving a session cookie to its user.

-- USERS -----------------------------------------------------------------------
CREATE TABLE users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL,
  name          text NOT NULL,
  designation   text,
  role          text NOT NULL CHECK (role IN ('state_assessor', 'centre')),
  state_id      uuid REFERENCES states(id),
  password_hash text NOT NULL,
  active        boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  -- A state assessor belongs to exactly one state; the centre belongs to none.
  CONSTRAINT users_role_state_ck CHECK (
    (role = 'state_assessor' AND state_id IS NOT NULL) OR
    (role = 'centre' AND state_id IS NULL)
  )
);

-- Case-insensitive unique email without the citext extension (keeps NIC portability).
CREATE UNIQUE INDEX users_email_lower_uk ON users (lower(email));
CREATE INDEX users_state_idx ON users (state_id);

-- Business rule #6: one active assessor per state at a time. The assessor may change
-- between rounds; submitted assessments snapshot who submitted them, so history is safe.
CREATE UNIQUE INDEX users_one_active_assessor_per_state
  ON users (state_id)
  WHERE role = 'state_assessor' AND active;

ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Read: own row; the centre sees all users (the "State assessors" screen); a state
-- assessor sees only users within their own state. This is the structural guarantee
-- that one state cannot read another state's user rows even if API code is wrong.
CREATE POLICY users_select ON users
  FOR SELECT
  USING (
    id = nullif(current_setting('app.user_id', true), '')::uuid
    OR current_setting('app.role', true) = 'centre'
    OR (
      current_setting('app.role', true) = 'state_assessor'
      AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
    )
  );

-- Write: only the centre manages users (user management is a Centre capability).
CREATE POLICY users_centre_insert ON users
  FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'centre');

CREATE POLICY users_centre_update ON users
  FOR UPDATE
  USING (current_setting('app.role', true) = 'centre')
  WITH CHECK (current_setting('app.role', true) = 'centre');

GRANT SELECT, INSERT, UPDATE ON users TO dmm_app;

-- SESSIONS --------------------------------------------------------------------
-- The cookie carries only this opaque id. No session data or tokens live in the browser.
CREATE TABLE sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);
CREATE INDEX sessions_user_idx ON sessions (user_id);
CREATE INDEX sessions_expires_idx ON sessions (expires_at);

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- No policies and no direct grants to dmm_app: the app role cannot read or write the
-- sessions table directly at all. Its entire lifecycle goes through the SECURITY
-- DEFINER functions below. Even a SQL injection reaching `SELECT * FROM sessions`
-- as dmm_app returns zero rows.

-- AUTH FUNCTIONS (SECURITY DEFINER) -------------------------------------------
-- Owned by the schema owner (bypasses RLS), so they can serve the pre-context reads
-- above. Each is the single narrow, reviewable bypass and returns the minimum needed.

-- Look up a user by email for credential verification. The API verifies the returned
-- argon2 hash itself; this function trusts no claimed identity.
CREATE FUNCTION auth_lookup_by_email(p_email text)
RETURNS TABLE (
  id uuid, email text, name text, designation text,
  role text, state_id uuid, password_hash text, active boolean
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, email, name, designation, role, state_id, password_hash, active
  FROM users
  WHERE lower(email) = lower(p_email)
$$;

-- Create a session for an already-authenticated user.
CREATE FUNCTION session_create(p_user_id uuid, p_ttl_hours numeric)
RETURNS TABLE (id uuid, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO sessions (user_id, expires_at)
  VALUES (p_user_id, now() + make_interval(hours => p_ttl_hours::int))
  RETURNING id, expires_at
$$;

-- Resolve a session cookie to the security context the API uses to set app.* GUCs.
-- Returns nothing for expired sessions or inactive users.
CREATE FUNCTION session_resolve(p_session_id uuid)
RETURNS TABLE (
  session_id uuid, user_id uuid, role text, state_id uuid,
  name text, email text, designation text, expires_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id, u.id, u.role, u.state_id, u.name, u.email, u.designation, s.expires_at
  FROM sessions s
  JOIN users u ON u.id = s.user_id
  WHERE s.id = p_session_id
    AND s.expires_at > now()
    AND u.active
$$;

-- Destroy a single session (logout).
CREATE FUNCTION session_destroy(p_session_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  DELETE FROM sessions WHERE id = p_session_id
$$;

-- Only the app role may execute these, and only EXECUTE — never read the tables behind.
REVOKE ALL ON FUNCTION auth_lookup_by_email(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION session_create(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION session_resolve(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION session_destroy(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION auth_lookup_by_email(text) TO dmm_app;
GRANT EXECUTE ON FUNCTION session_create(uuid, numeric) TO dmm_app;
GRANT EXECUTE ON FUNCTION session_resolve(uuid) TO dmm_app;
GRANT EXECUTE ON FUNCTION session_destroy(uuid) TO dmm_app;
