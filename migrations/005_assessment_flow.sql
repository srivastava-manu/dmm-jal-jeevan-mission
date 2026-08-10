-- 005_assessment_flow.sql
-- Tables the state assessment flow needs: a state's own `systems` (named once, reused as
-- evidence) and `score_evidence` (the system/districts/go-live attached to a score of 3 or
-- 4). Also adds a DELETE policy so an assessor can discard/replace their own draft.

-- SYSTEMS --------------------------------------------------------------------
CREATE TABLE systems (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  state_id       uuid NOT NULL REFERENCES states(id),
  name           text NOT NULL,
  districts_live int,
  go_live        date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (state_id, name)
);
CREATE INDEX systems_state_idx ON systems (state_id);

ALTER TABLE systems ENABLE ROW LEVEL SECURITY;

-- A state assessor manages only their own state's systems.
CREATE POLICY systems_select ON systems FOR SELECT
  USING (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );
CREATE POLICY systems_insert ON systems FOR INSERT
  WITH CHECK (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );
CREATE POLICY systems_update ON systems FOR UPDATE
  USING (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  )
  WITH CHECK (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );
GRANT SELECT, INSERT, UPDATE ON systems TO dmm_app;

-- SCORE EVIDENCE -------------------------------------------------------------
-- One evidence row per score. Only meaningful for scores of 3 or 4, but that rule is
-- applied by the API/UI; the table just stores what is attached.
CREATE TABLE score_evidence (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  score_id       uuid NOT NULL UNIQUE REFERENCES scores(id) ON DELETE CASCADE,
  system_id      uuid REFERENCES systems(id),
  districts_live int,
  go_live        date
);
CREATE INDEX score_evidence_system_idx ON score_evidence (system_id);

ALTER TABLE score_evidence ENABLE ROW LEVEL SECURITY;

-- Evidence inherits its score's (and thus its assessment's) visibility. Writes require the
-- owning assessment to be the assessor's own and still editable (draft or within the lock).
CREATE POLICY score_evidence_select ON score_evidence FOR SELECT
  USING (EXISTS (SELECT 1 FROM scores s WHERE s.id = score_evidence.score_id));

CREATE POLICY score_evidence_insert ON score_evidence FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM scores s JOIN assessments a ON a.id = s.assessment_id
    WHERE s.id = score_evidence.score_id
      AND current_setting('app.role', true) = 'state_assessor'
      AND a.state_id = nullif(current_setting('app.state_id', true), '')::uuid
      AND (a.status = 'draft' OR now() < a.locked_at)
  ));

CREATE POLICY score_evidence_update ON score_evidence FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM scores s JOIN assessments a ON a.id = s.assessment_id
    WHERE s.id = score_evidence.score_id
      AND current_setting('app.role', true) = 'state_assessor'
      AND a.state_id = nullif(current_setting('app.state_id', true), '')::uuid
      AND (a.status = 'draft' OR now() < a.locked_at)
  ));
GRANT SELECT, INSERT, UPDATE ON score_evidence TO dmm_app;

-- ASSESSMENT DELETE ----------------------------------------------------------
-- An assessor may delete their own state's DRAFT (never a submitted snapshot). Deleting a
-- draft cascades to its scores and their evidence via the existing FKs.
CREATE POLICY assessments_delete ON assessments FOR DELETE
  USING (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
    AND status = 'draft'
  );
GRANT DELETE ON assessments TO dmm_app;
