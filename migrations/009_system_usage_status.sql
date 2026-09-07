-- Let state assessors explicitly record whether a catalogued system is currently in use.
-- Preserve the previous displayed meaning for existing rows during the migration.
ALTER TABLE systems ADD COLUMN currently_in_use boolean;

UPDATE systems sys
SET currently_in_use = EXISTS (
  SELECT 1 FROM scores sc WHERE sc.system_id = sys.id
);

ALTER TABLE systems
  ALTER COLUMN currently_in_use SET NOT NULL,
  ALTER COLUMN currently_in_use SET DEFAULT true;