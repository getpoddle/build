/*
  # Fix Infinite Recursion in pod_members Policies

  1. Problem
    - The SELECT policy checks pod_members within itself, causing infinite recursion
    - Policy tried to verify membership by querying the same table it's protecting

  2. Solution
    - Simplify the SELECT policy to avoid self-reference
    - Allow users to see their own membership records
    - Allow viewing memberships of public/shared pods without circular checks
    
  3. Changes
    - Drop the problematic policy
    - Create a simple, non-recursive policy
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "Authenticated users can view pod members" ON pod_members;

-- Create a simple policy that doesn't cause recursion
-- Users can see their own memberships and memberships of public/shared pods
CREATE POLICY "Users can view pod memberships"
  ON pod_members
  FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR 
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND (pods.is_public = true OR pods.share_token IS NOT NULL)
    )
  );
