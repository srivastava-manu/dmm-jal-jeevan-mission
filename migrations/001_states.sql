-- 001_states.sql
-- Reference table for the 28 States + 8 Union Territories (source: dmm-model.js STATES).
-- States are public reference data: the "About the model" page and the sign-in state
-- picker must list them without authentication, so RLS allows unconditional SELECT.

CREATE TABLE states (
  id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name  text NOT NULL UNIQUE,
  is_ut boolean NOT NULL DEFAULT false
);

-- RLS is enabled on every table. The app connects as a NON-owner, non-superuser role
-- (dmm_app), so policies are enforced against it. The schema owner (migrations, seed,
-- and SECURITY DEFINER auth functions) bypasses RLS by ownership — the canonical
-- Postgres pattern. A startup guard (server/src/db/pool.ts) refuses to run if the app
-- role can bypass RLS, which is what FORCE would otherwise defend against.
ALTER TABLE states ENABLE ROW LEVEL SECURITY;

CREATE POLICY states_read_all ON states
  FOR SELECT
  USING (true);

INSERT INTO states (name, is_ut) VALUES
  ('Andaman and Nicobar Islands', true),
  ('Andhra Pradesh', false),
  ('Arunachal Pradesh', false),
  ('Assam', false),
  ('Bihar', false),
  ('Chandigarh', true),
  ('Chhattisgarh', false),
  ('Dadra and Nagar Haveli and Daman and Diu', true),
  ('Delhi (National Capital Territory)', true),
  ('Goa', false),
  ('Gujarat', false),
  ('Haryana', false),
  ('Himachal Pradesh', false),
  ('Jammu and Kashmir', true),
  ('Jharkhand', false),
  ('Karnataka', false),
  ('Kerala', false),
  ('Ladakh', true),
  ('Lakshadweep', true),
  ('Madhya Pradesh', false),
  ('Maharashtra', false),
  ('Manipur', false),
  ('Meghalaya', false),
  ('Mizoram', false),
  ('Nagaland', false),
  ('Odisha', false),
  ('Puducherry', true),
  ('Punjab', false),
  ('Rajasthan', false),
  ('Sikkim', false),
  ('Tamil Nadu', false),
  ('Telangana', false),
  ('Tripura', false),
  ('Uttar Pradesh', false),
  ('Uttarakhand', false),
  ('West Bengal', false);

-- The application role may read states; it never writes them (reference data).
GRANT SELECT ON states TO dmm_app;
