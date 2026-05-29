/*
  # Create get_digest_recipients function

  Returns a list of real users (with email) who have email notifications enabled,
  excluding test/anonymous accounts. Used by the send-weekly-digest edge function.
*/

CREATE OR REPLACE FUNCTION public.get_digest_recipients()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.id AS user_id,
    au.email,
    p.first_name,
    p.full_name
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE p.email_notifications_enabled = true
    AND au.email IS NOT NULL
    AND au.email NOT LIKE '%@anonymous.local'
    AND au.email NOT LIKE 'testuser%'
  ORDER BY au.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_digest_recipients() TO service_role;
