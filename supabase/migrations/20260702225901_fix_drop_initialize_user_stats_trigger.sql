-- Drop the trigger and its function that reference the dropped user_stats table.
-- user_stats was removed in migration 20260702131635_drop_legacy_b2c_social_tables.sql
-- but this trigger was never cleaned up, causing "database error saving new user"
-- on every signup because the INSERT INTO user_stats fails.

DROP TRIGGER IF EXISTS trigger_initialize_user_stats ON public.profiles;
DROP FUNCTION IF EXISTS public.initialize_user_stats() CASCADE;
