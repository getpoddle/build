-- Fix the "Users can update profiles" RLS policy that references is_admin.
--
-- The column restriction migration (20260731130000) revoked SELECT on is_admin
-- from authenticated. The UPDATE policy's USING/WITH CHECK clauses reference
-- p.is_admin in a subquery — which now errors with a permission denied when
-- PostgREST evaluates the policy. This causes profile queries to fail during
-- the SIGNED_IN flow, which the AuthContext catch block treats as a timeout,
-- leaving the session half-initialized and triggering a logout.
--
-- Fix: replace the direct is_admin reference with a SECURITY DEFINER function
-- that checks admin status without requiring column-level SELECT on is_admin.

-- 1. Create a SECURITY DEFINER function to check if the current user is an admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT p.is_admin FROM public.profiles p WHERE p.id = auth.uid()),
    false
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated;

-- 2. Drop the old policy that references is_admin directly
DROP POLICY IF EXISTS "Users can update profiles" ON public.profiles;

-- 3. Recreate the policy using the SECURITY DEFINER function
CREATE POLICY "Users can update profiles" ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id OR public.is_current_user_admin())
  WITH CHECK (auth.uid() = id OR public.is_current_user_admin());

-- 4. Force PostgREST to reload its schema cache so it picks up the new function
--    and the updated policy. This is critical — without it, PostgREST may still
--    use the cached old policy that references is_admin directly.
NOTIFY pgrst, 'Reload schema';