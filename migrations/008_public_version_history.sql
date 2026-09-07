-- 008_public_version_history.sql
-- Separates the two audiences of a model version's description.
--
-- `notes` stays internal: how the version was produced, for whoever maintains this repo.
-- `public_notes` is written FOR state officials and citizens, and is what the About page
-- lists. A version with public_notes IS NULL is not listed at all.
--
-- The rule this encodes: a version is public when it changed what a score MEANS — a
-- capability added, retired or renamed, or a measure reworded so that the same practice now
-- earns a different rating. Those are the versions a reader needs in order to interpret a
-- score trend that crosses them. Regenerating from dmm-model.js, fixing a typo or reordering
-- capabilities changes nothing for that reader, so it stays unlisted.
--
-- NULL is the deliberate default. A new version is private until someone writes a sentence a
-- state official would understand — which is the same moment they decide it is worth showing.
-- Hidden versions still exist: assessments reference them and cross-version compare reads
-- their capabilities. This governs presentation only, never retention.

ALTER TABLE model_versions ADD COLUMN IF NOT EXISTS public_notes text;

COMMENT ON COLUMN model_versions.notes IS
  'Internal provenance. Never shown outside the team.';
COMMENT ON COLUMN model_versions.public_notes IS
  'Written for state officials and citizens; NULL hides the version from the About page. '
  'Set it only when the version changed what a score means.';

-- v2.1 — the model every assessment to date was taken against, and the first version anyone
-- outside the programme has seen.
--
-- published_at is set EXPLICITLY here. It previously fell back to DEFAULT now(), which
-- recorded when each database happened to be migrated: the same version showed a different
-- date in every environment, presented to the public as a publication date. An explicit
-- constant makes every environment agree.
-- Stored at UTC midnight, not IST: the client formats dates with UTC getters so that every
-- reader sees the same day whatever their device timezone. An IST midnight would render as
-- the previous day.
UPDATE model_versions
   SET published_at  = TIMESTAMPTZ '2026-08-13 00:00:00+00',
       public_notes  = 'First published version of the model. Every assessment recorded so '
                       'far uses this version, so scores are directly comparable across all '
                       'rounds and all states.'
 WHERE version = 'v2.1';
