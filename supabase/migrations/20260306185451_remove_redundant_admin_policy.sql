/*
  # Remove Redundant Admin Policy Causing Infinite Recursion

  ## Problem
  The "Admins can view verification requests" policy on profiles causes infinite recursion
  and is redundant because "Everyone can view all profiles" already allows SELECT.

  ## Solution
  Simply drop the redundant policy. The existing "Everyone can view all profiles" policy
  already allows authenticated and anonymous users to view all profiles.

  ## Changes
  - Drop the "Admins can view verification requests" policy
  - Keep the simpler "Everyone can view all profiles" policy
*/

-- Drop the redundant and problematic policy
DROP POLICY IF EXISTS "Admins can view verification requests" ON profiles;
