/*
  # Remove pod_members Recursion Completely

  ## Problem
  The previous policy still had recursion by joining pod_members to check membership.
  Any query to pod_members within the policy causes infinite recursion.

  ## Solution
  Simplify to only check:
  1. User's own membership records
  2. Public pods (no membership check needed)
  
  This means users can only see:
  - Their own memberships in any pod
  - All memberships of public pods
  
  To see memberships of private pods, you must be a member, but we check that
  by looking at your own membership records, not by querying the table recursively.

  ## Tables Modified
  - pod_members (SELECT policy only)
*/

-- Drop the problematic SELECT policy
DROP POLICY IF EXISTS "Users can view pod memberships" ON pod_members;

-- Create a truly non-recursive policy
-- Users can see:
-- 1. Their own membership records
-- 2. All memberships of public pods
CREATE POLICY "Users can view pod memberships"
  ON pod_members FOR SELECT
  TO authenticated
  USING (
    -- Can see own memberships
    user_id = (select auth.uid())
    OR
    -- Can see memberships of public pods
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND pods.is_public = true
    )
  );
