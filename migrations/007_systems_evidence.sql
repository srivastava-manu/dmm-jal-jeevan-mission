-- 007_systems_evidence.sql
-- Make the evidence link `scores.system_id` (was a separate score_evidence table). Districts
-- covered and go-live now live on the SYSTEM, so correcting a system propagates to every
-- assessment that cites it — including submitted ones — which is the intended behaviour.

ALTER TABLE systems ADD COLUMN updated_at timestamptz NOT NULL DEFAULT now();

-- The evidence link. ON DELETE is the default (RESTRICT): a system cited by any score cannot
-- be deleted at the database level.
ALTER TABLE scores ADD COLUMN system_id uuid REFERENCES systems(id);

-- Carry existing evidence links across, then retire the per-score evidence table.
UPDATE scores s
SET system_id = e.system_id
FROM score_evidence e
WHERE e.score_id = s.id AND e.system_id IS NOT NULL;

DROP TABLE score_evidence;

CREATE INDEX scores_system_idx ON scores (system_id);

-- Systems: the Centre may read (state detail / export); the owning state may delete its own.
CREATE POLICY systems_centre_select ON systems FOR SELECT
  USING (current_setting('app.role', true) = 'centre');
CREATE POLICY systems_delete ON systems FOR DELETE
  USING (
    current_setting('app.role', true) = 'state_assessor'
    AND state_id = nullif(current_setting('app.state_id', true), '')::uuid
  );
GRANT DELETE ON systems TO dmm_app;

-- A state assessor may write audit rows (system edits are logged, actor = the state user).
CREATE POLICY audit_state_insert ON audit_log FOR INSERT
  WITH CHECK (current_setting('app.role', true) = 'state_assessor');
