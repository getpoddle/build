/*
  # Fix get_supabase_url() with hardcoded fallback

  ## Summary
  The get_supabase_url() helper function previously returned an empty string when
  the app.settings.supabase_url config setting was not present, causing all
  database-triggered email notifications to silently fail (the HTTP call would
  go nowhere). This migration adds the real project URL as a hardcoded fallback
  so triggers always have a valid endpoint to call.
*/

CREATE OR REPLACE FUNCTION get_supabase_url()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := current_setting('app.settings', true)::json->>'supabase_url';
  END IF;
  RETURN COALESCE(NULLIF(v_url, ''), 'https://bggdthmhcanzzuqkztdo.supabase.co');
END;
$$;

CREATE OR REPLACE FUNCTION get_supabase_anon_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.settings.supabase_anon_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings', true)::json->>'supabase_anon_key';
  END IF;
  RETURN COALESCE(NULLIF(v_key, ''), 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZ2R0aG1oY2Fuenp1cWt6dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTE3NTgsImV4cCI6MjA4NTI2Nzc1OH0.uocKHVkPNwT1NzuKO6fsC0G5lpWt5uVzPyGCD5X_DR0');
END;
$$;
