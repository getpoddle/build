
/*
  # Fix assumption_forecasts foreign key to reference profiles instead of auth.users

  ## Problem
  assumption_forecasts.user_id references auth.users(id), but PostgREST can only
  auto-join to tables it introspects (public schema). The app queries use:
    .select('*, profiles:user_id(full_name, avatar_url)')
  which requires a FK from user_id -> profiles(id).

  ## Changes
  - Drop existing assumption_forecasts_user_id_fkey (points to auth.users)
  - Add new FK: assumption_forecasts.user_id -> profiles(id) ON DELETE CASCADE

  Note: profiles.id is always in sync with auth.users.id via trigger, so this
  is safe. All existing data references valid profile IDs.

  Also add missing UPDATE RLS policy for assumption_scenarios so upsert-style
  patterns work correctly in the future.
*/

ALTER TABLE assumption_forecasts
  DROP CONSTRAINT IF EXISTS assumption_forecasts_user_id_fkey;

ALTER TABLE assumption_forecasts
  ADD CONSTRAINT assumption_forecasts_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
