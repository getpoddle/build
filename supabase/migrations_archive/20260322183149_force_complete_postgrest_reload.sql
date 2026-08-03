/*
  # Force Complete PostgREST Reload

  1. Problem
    - PostgREST API layer has cached old schema with 'title' column
    - Direct database inserts work, but API calls fail with PGRST204 error

  2. Solution
    - Create a dummy column and immediately drop it to force schema change detection
    - This will trigger PostgREST to invalidate its entire schema cache
    - Send NOTIFY signals to ensure reload happens
*/

-- Force schema change by adding and removing a dummy column
DO $$
BEGIN
  -- Add temporary column
  ALTER TABLE pod_assumptions ADD COLUMN IF NOT EXISTS _temp_reload_trigger boolean DEFAULT false;
  
  -- Immediately remove it
  ALTER TABLE pod_assumptions DROP COLUMN IF EXISTS _temp_reload_trigger;
END $$;

-- Force PostgREST reload
NOTIFY pgrst, 'reload schema';
NOTIFY pgrst, 'reload config';

-- Wait a moment and send again
DO $$
BEGIN
  PERFORM pg_sleep(0.1);
END $$;

NOTIFY pgrst, 'reload schema';
