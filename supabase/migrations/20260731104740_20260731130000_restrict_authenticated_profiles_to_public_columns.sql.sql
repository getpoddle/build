-- Extend column-level restriction to the authenticated role.
--
-- Migration 20260716121738 only restricted anon. authenticated users could
-- still read every column on every profile — including is_admin,
-- subscription_tier, deletion_requested_at, trial_workspace_count, and email
-- — through the broad "Everyone can view all profiles" RLS policy.
--
-- This migration:
--   1. Revokes table-level SELECT from authenticated
--   2. Grants column-level SELECT back for public-display columns only
--   3. Creates a SECURITY DEFINER function for self-only sensitive column access
--
-- After this migration:
--   - authenticated querying profiles for sensitive columns → those columns
--     return null (PostgREST silently drops columns the role lacks SELECT on)
--   - authenticated querying profiles for public columns → works as before
--   - Sensitive columns are only accessible via get_own_profile_sensitive()
--     which returns data for the calling user only (auth.uid())

-- 1. Revoke all table-level SELECT from authenticated
REVOKE SELECT ON public.profiles FROM authenticated;

-- 2. Grant column-scoped SELECT back to authenticated for public-display fields
GRANT SELECT (
  id, full_name, first_name, last_name, username, avatar_url, verified,
  job_title, bio, about_me, country, location, linkedin_url,
  education, certifications, job_experience,
  referral_points, referral_tier,
  created_at, updated_at, onboarded,
  theme_preference, email_notifications_enabled,
  verification_requested_at, verified_at
) ON public.profiles TO authenticated;

-- 3. Create SECURITY DEFINER function for self-only sensitive column access.
--    Returns sensitive columns for the calling user only — never for other users.
CREATE OR REPLACE FUNCTION public.get_own_profile_sensitive()
RETURNS TABLE (
  is_admin boolean,
  subscription_tier text,
  deletion_requested_at timestamptz,
  trial_workspace_count integer,
  email text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT p.is_admin, p.subscription_tier, p.deletion_requested_at,
         p.trial_workspace_count, p.email
  FROM public.profiles p
  WHERE p.id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_own_profile_sensitive() TO authenticated;