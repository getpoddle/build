/*
  # Fix Public Pod Access for Authenticated Users

  1. Changes
    - Add RLS policies for authenticated users to view public pods
    - Previously only anon users could view shared pods
    - Now both authenticated and anonymous users can view shared pods

  2. Security
    - Public access only for pods with `is_public = true` and valid share_token
    - Read-only access for public pods
    - No modification rights granted
*/

-- Add policy for authenticated users to view shared pods
CREATE POLICY "Authenticated can view shared pods"
  ON pods FOR SELECT
  TO authenticated
  USING (is_public = true AND share_token IS NOT NULL);

-- Add policy for authenticated users to view insights of shared pods
CREATE POLICY "Authenticated can view insights of shared pods"
  ON insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = insights.pod_id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );

-- Add policy for authenticated users to view comments of shared pods
CREATE POLICY "Authenticated can view comments of shared pods"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM insights
      INNER JOIN pods ON pods.id = insights.pod_id
      WHERE insights.id = comments.insight_id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );

-- Add policy for authenticated users to view pod members of shared pods
CREATE POLICY "Authenticated can view members of shared pods"
  ON pod_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );

-- Add policy for authenticated users to view profiles of members in shared pods
CREATE POLICY "Authenticated can view profiles of shared pod members"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      INNER JOIN pods ON pods.id = pod_members.pod_id
      WHERE pod_members.user_id = profiles.id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );