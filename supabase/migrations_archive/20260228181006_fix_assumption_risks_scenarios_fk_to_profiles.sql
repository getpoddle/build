
/*
  # Fix assumption_risks and assumption_scenarios created_by FK to reference profiles

  ## Problem
  assumption_risks.created_by and assumption_scenarios.created_by both reference
  auth.users(id). PostgREST cannot auto-join across schemas, so the app's query:
    .select('*, profiles:created_by(full_name)')
  silently returns null for the profiles join.

  ## Changes
  - Drop assumption_risks_created_by_fkey (was pointing to auth.users)
  - Add new FK: assumption_risks.created_by -> profiles(id) ON DELETE CASCADE
  - Drop assumption_scenarios_created_by_fkey (was pointing to auth.users)
  - Add new FK: assumption_scenarios.created_by -> profiles(id) ON DELETE CASCADE

  profiles.id is always synced with auth.users.id, so all existing data is valid.
*/

ALTER TABLE assumption_risks
  DROP CONSTRAINT IF EXISTS assumption_risks_created_by_fkey;

ALTER TABLE assumption_risks
  ADD CONSTRAINT assumption_risks_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;

ALTER TABLE assumption_scenarios
  DROP CONSTRAINT IF EXISTS assumption_scenarios_created_by_fkey;

ALTER TABLE assumption_scenarios
  ADD CONSTRAINT assumption_scenarios_created_by_fkey
  FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
