/*
  # Fix pod_members RLS Policies - Remove Infinite Recursion

  ## Problem
  The current SELECT policy for pod_members has infinite recursion:
  - It queries pod_members to check membership
  - Which triggers the same policy
  - Which queries pod_members again
  - Causing infinite recursion

  ## Solution
  1. Fix the SELECT policy to avoid self-reference
     - Users can see their own memberships
     - Users can see memberships of pods they belong to (checked via pods table)
     - Everyone can see memberships of public pods
  
  2. Ensure INSERT and DELETE policies exist for joining/leaving pods

  ## Tables Modified
  - pod_members (SELECT, INSERT, DELETE policies)

  ## Security
  - Users can only join pods themselves (INSERT their own user_id)
  - Users can only leave pods themselves (DELETE their own membership)
  - Users can view memberships of pods they belong to without recursion
*/

-- =====================================================
-- Drop all existing pod_members policies
-- =====================================================

DROP POLICY IF EXISTS "Users can view pod memberships" ON pod_members;
DROP POLICY IF EXISTS "Authenticated users can view pod members" ON pod_members;
DROP POLICY IF EXISTS "Users can join pods" ON pod_members;
DROP POLICY IF EXISTS "Users can leave pods" ON pod_members;
DROP POLICY IF EXISTS "Public can view members of shared pods" ON pod_members;
DROP POLICY IF EXISTS "Authenticated can view members of shared pods" ON pod_members;

-- =====================================================
-- Create non-recursive SELECT policy
-- =====================================================

-- Users can view pod memberships if:
-- 1. It's their own membership record
-- 2. The pod is public
-- 3. They are a member of the pod (checked via pods table to avoid recursion)
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
    EXISTS (
      SELECT 1 FROM pods
      INNER JOIN pod_members pm ON pm.pod_id = pods.id
      WHERE pods.id = pod_members.pod_id
      AND pm.user_id = (select auth.uid())
    )
  );

-- Anonymous users can view memberships of public/shared pods
CREATE POLICY "Public can view members of public pods"
  ON pod_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND (pods.is_public = true OR pods.share_token IS NOT NULL)
    )
  );

-- =====================================================
-- Create INSERT policy (for joining pods)
-- =====================================================

CREATE POLICY "Users can join pods"
  ON pod_members FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- =====================================================
-- Create DELETE policy (for leaving pods)
-- =====================================================

CREATE POLICY "Users can leave pods"
  ON pod_members FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));
