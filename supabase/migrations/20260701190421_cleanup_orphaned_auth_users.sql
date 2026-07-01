
-- Function callable by admins to clean up auth.users records that have no profile.
-- These arise when delete_user_account RPC runs but auth.admin.deleteUser never fires.
-- The function is SECURITY DEFINER so it runs with the permissions of the defining role,
-- which has access to auth.users.
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_auth_users()
RETURNS TABLE (deleted_id uuid, deleted_email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
    DELETE FROM auth.users u
    USING (
      SELECT au.id
      FROM auth.users au
      LEFT JOIN public.profiles p ON p.id = au.id
      WHERE p.id IS NULL
        AND au.deleted_at IS NULL
        -- only remove accounts older than 30 minutes to avoid racing a slow profile insert
        AND au.created_at < now() - interval '30 minutes'
    ) orphans
    WHERE u.id = orphans.id
    RETURNING u.id, u.email;
END;
$$;

-- Only admins can call this
REVOKE ALL ON FUNCTION public.cleanup_orphaned_auth_users() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_auth_users() TO service_role;
