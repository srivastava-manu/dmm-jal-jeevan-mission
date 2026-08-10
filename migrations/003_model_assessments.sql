-- 003_model_assessments.sql
-- The versioned model (model_versions + capabilities) and the assessment record
-- (assessments + scores). This is where the two headline Centre business rules live in
-- the database itself: the Centre can only ever see submitted assessments, and score
-- writes are refused once an assessment locks (7 days after submission).

-- MODEL ----------------------------------------------------------------------
CREATE TABLE model_versions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version      text NOT NULL UNIQUE,
  published_at timestamptz NOT NULL DEFAULT now(),
  notes        text
);
ALTER TABLE model_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY model_versions_read_all ON model_versions FOR SELECT USING (true);
GRANT SELECT ON model_versions TO dmm_app;

-- The 48 capabilities. Content — not code: names/measures/includes change between
-- versions, and each assessment records which version it was taken against.
CREATE TABLE capabilities (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id uuid NOT NULL REFERENCES model_versions(id),
  layer_index      int NOT NULL CHECK (layer_index BETWEEN 0 AND 7),
  layer_name       text NOT NULL,
  layer_covers     text NOT NULL,
  order_in_layer   int NOT NULL CHECK (order_in_layer BETWEEN 0 AND 5),
  name             text NOT NULL,
  measure          text NOT NULL,
  includes         text[] NOT NULL DEFAULT '{}',
  UNIQUE (model_version_id, layer_index, order_in_layer)
);
ALTER TABLE capabilities ENABLE ROW LEVEL SECURITY;
-- Public reference data: the "About the model" page (no sign-in) shows layers/capabilities.
CREATE POLICY capabilities_read_all ON capabilities FOR SELECT USING (true);
GRANT SELECT ON capabilities TO dmm_app;

-- ASSESSMENTS ----------------------------------------------------------------
CREATE TABLE assessments (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id             uuid NOT NULL REFERENCES states(id),
  assessor_user_id     uuid REFERENCES users(id),
  model_version_id     uuid NOT NULL REFERENCES model_versions(id),
  status               text NOT NULL CHECK (status IN ('draft', 'submitted')),
  -- Snapshotted at submit: who submitted stays fixed even if the state's assessor changes.
  assessor_name        text,
  assessor_designation text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  submitted_at         timestamptz,
  locked_at            timestamptz,
  CONSTRAINT assessment_submit_snapshot_ck CHECK (
    status = 'draft'
    OR (submitted_at IS NOT NULL AND locked_at IS NOT NULL AND assessor_name IS NOT NULL)
  )
);
-- At most one draft per state (a submitted assessment is a dated snapshot; many allowed).
CREATE UNIQUE INDEX assessments_one_draft_per_state
  ON assessments (state_id) WHERE status = 'draft';
CREATE INDEX assessments_state_idx ON assessments (state_id);
CREATE INDEX assessments_status_idx ON assessments (status);
CREATE INDEX assessments_submitted_idx ON assessments (state_id, submitted_at DESC);

ALTER TABLE assessments ENABLE ROW LEVEL SECURITY;

-- Business rule #1: the Centre can ONLY see submitted assessments — a draft is invisible
-- to the Centre at the database level, not merely hidden in the UI. An assessor sees only
-- their own state's assessments.
CREATE POLICY assessments_select ON assessments FOR SELECT
  USING (
    (current_setting('app.role', true) = 'state_assessor'
      AND state_id = nullif(current_setting('app.state_id', true), '')::uuid)
    OR (current_setting('app.role', true) = 'centre' AND status = 'submitted')
  );

CREATE POLICY assessments_insert ON assessments FOR INSERT
  WITH CHECK (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );

-- Business rule #3: after the 7-day lock, score/assessment writes are refused by RLS —
-- regardless of what the API code does. now() < locked_at is required to update.
CREATE POLICY assessments_update ON assessments FOR UPDATE
  USING (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
    AND (status = 'draft' OR now() < locked_at)
  )
  WITH CHECK (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );

GRANT SELECT, INSERT, UPDATE ON assessments TO dmm_app;

-- SCORES ---------------------------------------------------------------------
CREATE TABLE scores (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  capability_id uuid NOT NULL REFERENCES capabilities(id),
  value         int CHECK (value BETWEEN 0 AND 4),
  note          text,
  UNIQUE (assessment_id, capability_id)
);
CREATE INDEX scores_assessment_idx ON scores (assessment_id);
CREATE INDEX scores_capability_idx ON scores (capability_id);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;

-- Scores inherit their assessment's visibility. Because RLS on `assessments` also applies
-- inside this subquery, a Centre user's scores are automatically limited to submitted
-- assessments, and an assessor's to their own state — the rule lives in one place.
CREATE POLICY scores_select ON scores FOR SELECT
  USING (EXISTS (SELECT 1 FROM assessments a WHERE a.id = scores.assessment_id));

CREATE POLICY scores_insert ON scores FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = scores.assessment_id
      AND current_setting('app.role', true) = 'state_assessor'
      AND a.state_id = nullif(current_setting('app.state_id', true), '')::uuid
      AND (a.status = 'draft' OR now() < a.locked_at)
  ));

CREATE POLICY scores_update ON scores FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM assessments a
    WHERE a.id = scores.assessment_id
      AND current_setting('app.role', true) = 'state_assessor'
      AND a.state_id = nullif(current_setting('app.state_id', true), '')::uuid
      AND (a.status = 'draft' OR now() < a.locked_at)
  ));

GRANT SELECT, INSERT, UPDATE ON scores TO dmm_app;
