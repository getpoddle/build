/*
# Create get_profiles_sensitive_admin RPC

## Purpose
Provides admin-only batch access to sensitive profile columns (email, is_admin,
subscription_tier, deletion_requested_at, trial_workspace_count) that were revoked
from the authenticated role in the RLS lockdown migration. The admin dashboard
uses this to merge sensitive fields onto the base user list without granting
column-level access to non-admin users.

## How it works
- SECURITY DEFINER function — runs as the postgres superuser, bypassing RLS.
- Admin check: verifies the caller's auth.uid() exists in the admins table.
- Accepts an array of UUIDs (target_user_ids) and returns one row per ID with
  the sensitive columns. If an ID doesn't exist, it's simply omitted.
- Non-blocking audit log insert (same pattern as get_admin_all_users).

## Security
- Only callable by authenticated users whose ID is in the admins table.
- Returns only the sensitive columns — no mutations possible.
- SECURITY DEFINER with fixed search_path = public.
*/

CREATE OR REPLACE FUNCTION public.get_profiles_sensitive_admin(target_user_ids uuid[])
RETURNS TABLE (
  id                      uuid,
  email                   text,
  is_admin                boolean,
  subscription_tier       text,
  deletion_requested_at   timestamptz,
  trial_workspace_count   integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  BEGIN
    INSERT INTO admin_audit_log(admin_id, action)
    VALUES (auth.uid(), 'get_profiles_sensitive_admin');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    p.id,
    p.email,
    COALESCE(p.is_admin, false)   AS is_admin,
    p.subscription_tier          AS subscription_tier,
    p.deletion_requested_at       AS deletion_requested_at,
    COALESCE(p.trial_workspace_count, 0) AS trial_workspace_count
  FROM profiles p
  WHERE p.id = ANY(target_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_profiles_sensitive_admin(uuid[]) TO authenticated;
