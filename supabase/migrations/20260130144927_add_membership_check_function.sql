/*
  # Add Membership Check Function to Prevent Recursion

  ## Problem
  The pod_members SELECT policy needs to check if a user is a member of a pod
  to show them other members, but checking pod_members within the policy causes
  infinite recursion.

  ## Solution
  Create a SECURITY DEFINER function that bypasses RLS to check membership.
  This function can be safely called within the RLS policy without recursion.

  ## Changes
  1. Create is_pod_member() function with SECURITY DEFINER
  2. Update pod_members SELECT policy to use this function
  3. This allows users to see all members of pods they've joined

  ## Security
  - Function is SECURITY DEFINER but only checks membership
  - Cannot be abused for unauthorized data access
  - Uses secure search_path to prevent SQL injection
*/

-- =====================================================
-- Create Helper Function (SECURITY DEFINER bypasses RLS)
-- =====================================================

CREATE OR REPLACE FUNCTION is_pod_member(pod_uuid uuid, user_uuid uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM pod_members
    WHERE pod_id = pod_uuid
    AND user_id = user_uuid
  );
END;
$$;

-- =====================================================
-- Update pod_members SELECT Policy
-- =====================================================

DROP POLICY IF EXISTS "Users can view pod memberships" ON pod_members;

-- Users can see memberships if:
-- 1. It's their own membership
-- 2. The pod is public
-- 3. They are a member of that pod (checked via helper function)
CREATE POLICY "Users can view pod memberships"
  ON pod_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND pods.is_public = true
    )
    OR
    is_pod_member(pod_members.pod_id, (select auth.uid()))
  );
