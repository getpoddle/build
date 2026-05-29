/*
  # Fix Multiple Permissive Policies

  1. Security Improvements
    - Consolidate multiple permissive policies into single policies
    - Prevents unexpected access patterns
  
  2. Tables Fixed
    - content_reports: Merge admin and user SELECT policies
    - profiles: Merge admin and user UPDATE policies  
    - referral_codes: Merge public and user SELECT policies
*/

-- content_reports: Merge two SELECT policies into one
DROP POLICY IF EXISTS "Admins can view all reports" ON public.content_reports;
DROP POLICY IF EXISTS "Users can view their own reports" ON public.content_reports;

CREATE POLICY "Users can view reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (
    reporter_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

-- profiles: Merge two UPDATE policies into one
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update profiles"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  )
  WITH CHECK (
    id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- referral_codes: Merge two SELECT policies into one
DROP POLICY IF EXISTS "Anyone can view referral codes by code" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;

CREATE POLICY "Users can view referral codes"
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    true  -- Allow viewing by code for validation
  );
