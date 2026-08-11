-- 006_centre.sql
-- The Centre (NJJM) surface: support requests, an audit log for user-management actions,
-- the reassignment helper, and the policy changes that make Centre user management safe.

-- Centre-created assessors have no password until they set one (invite flow, later). The
-- app already rejects login when the hash is missing, so allow it to be null.
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- A Centre user may delete a user, but the FK from assessments.assessor_user_id is
-- ON DELETE RESTRICT (the default), so a user who owns any assessment cannot be deleted at
-- the database level. The API additionally refuses (409) anyone with submitted assessments.
CREATE POLICY users_centre_delete ON users FOR DELETE
  USING (current_setting('app.role', true) = 'centre');
GRANT DELETE ON users TO dmm_app;

-- AUDIT LOG ------------------------------------------------------------------
CREATE TABLE audit_log (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id   uuid REFERENCES users(id),
  action          text NOT NULL,
  target_user_id  uuid REFERENCES users(id),
  target_state_id uuid REFERENCES states(id),
  detail          text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_log_created_idx ON audit_log (created_at DESC);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_centre_select ON audit_log FOR SELECT
  USING (current_setting('app.role', true) = 'centre');
CREATE POLICY audit_centre_insert ON audit_log FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'centre');
GRANT SELECT, INSERT ON audit_log TO dmm_app;

-- SUPPORT REQUESTS -----------------------------------------------------------
-- Raised by a state from a capability scored 0 or 1 (business rule #10); answered by the
-- Centre with a status and a reply. No assignment, no SLA.
CREATE TABLE support_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id      uuid NOT NULL REFERENCES states(id),
  assessment_id uuid REFERENCES assessments(id) ON DELETE SET NULL,
  capability_id uuid NOT NULL REFERENCES capabilities(id),
  score_value   int CHECK (score_value BETWEEN 0 AND 4),
  message       text,
  status        text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'closed')),
  reply         text,
  replied_by    uuid REFERENCES users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX support_requests_state_idx ON support_requests (state_id);
CREATE INDEX support_requests_status_idx ON support_requests (status);

ALTER TABLE support_requests ENABLE ROW LEVEL SECURITY;

-- Both directions in RLS: a state assessor sees and creates only their own state's requests;
-- the Centre sees all and is the only role permitted to write status/reply.
CREATE POLICY sr_select ON support_requests FOR SELECT
  USING (
    (current_setting('app.role', true) = 'state_assessor'
      AND state_id = nullif(current_setting('app.state_id', true), '')::uuid)
    OR current_setting('app.role', true) = 'centre'
  );
CREATE POLICY sr_state_insert ON support_requests FOR INSERT
  WITH CHECK (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );
CREATE POLICY sr_centre_update ON support_requests FOR UPDATE
  USING (current_setting('app.role', true) = 'centre')
  WITH CHECK (current_setting('app.role', true) = 'centre');
GRANT SELECT, INSERT, UPDATE ON support_requests TO dmm_app;

-- REASSIGNMENT ---------------------------------------------------------------
-- Move a state's assessments to a new assessor. SECURITY DEFINER because the Centre role has
-- no UPDATE policy on assessments (only state assessors edit their own) — this is the single
-- controlled exception, used by the audited reassignment flow. Assessor NAME is snapshotted
-- on each submitted assessment, so moving ownership never rewrites who submitted a past round.
CREATE FUNCTION move_state_assessments(p_state uuid, p_new_user uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH moved AS (
    UPDATE assessments SET assessor_user_id = p_new_user WHERE state_id = p_state RETURNING 1
  )
  SELECT count(*)::int FROM moved
$$;
REVOKE ALL ON FUNCTION move_state_assessments(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION move_state_assessments(uuid, uuid) TO dmm_app;
