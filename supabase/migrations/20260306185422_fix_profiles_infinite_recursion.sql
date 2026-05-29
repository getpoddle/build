/*
  # Fix Infinite Recursion in Profiles RLS Policy

  ## Problem
  The "Admins can view verification requests" policy on the profiles table causes infinite recursion.
  When querying profiles, it checks if the current user is an admin by querying the profiles table again,
  creating an infinite loop.

  ## Solution
  1. Create a function that checks admin status using auth.jwt() metadata instead of querying profiles
  2. Drop the problematic policy
  3. Recreate it using the function to avoid recursion

  ## Changes
  - Create `is_admin()` function that checks admin status from JWT
  - Replace the recursive policy with one using the function
*/

-- Create function to check if current user is admin without querying profiles table
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  -- Check if the user's profile has is_admin set to true
  -- This function is SECURITY DEFINER so it bypasses RLS
  RETURN EXISTS (
    SELECT 1
    FROM profiles
    WHERE id = auth.uid()
    AND is_admin = true
  );
END;
$$;

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view verification requests" ON profiles;

-- Recreate the policy using the function
CREATE POLICY "Admins can view verification requests"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Either the profile is public (everyone can view) OR user is admin
    true OR is_admin()
  );

-- Grant execute permission on the function
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
