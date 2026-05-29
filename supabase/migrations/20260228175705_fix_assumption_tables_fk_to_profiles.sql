
/*
  # Fix assumption tables: add missing FK constraints to profiles

  ## Problem
  The assumption_forecasts, assumption_risks, and assumption_scenarios tables
  were created with user columns referencing auth.users, but Supabase PostgREST
  can only automatically join via foreign keys to tables it can introspect.
  Since profiles.id = auth.users.id (synced via trigger), changing the FKs to
  point to profiles enables the join syntax used in the app queries like:
    .select('*, profiles:user_id(full_name, avatar_url)')

  ## Changes
  - assumption_forecasts.user_id: add FK -> profiles(id)
  - assumption_risks.created_by: add FK -> profiles(id)
  - assumption_scenarios.created_by: add FK -> profiles(id)

  Note: We use DO blocks with IF NOT EXISTS checks to avoid errors on re-run.
  The actual column values remain the same (auth.uid() == profiles.id).
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'assumption_forecasts'
      AND kcu.column_name = 'user_id'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE assumption_forecasts
      ADD CONSTRAINT assumption_forecasts_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'assumption_risks'
      AND kcu.column_name = 'created_by'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE assumption_risks
      ADD CONSTRAINT assumption_risks_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'assumption_scenarios'
      AND kcu.column_name = 'created_by'
      AND tc.constraint_type = 'FOREIGN KEY'
  ) THEN
    ALTER TABLE assumption_scenarios
      ADD CONSTRAINT assumption_scenarios_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
