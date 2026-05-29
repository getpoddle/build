/*
  # Add Pod Sharing System

  1. Changes
    - Add `share_token` column to pods table for generating public shareable links
    - Add `is_public` column to pods table to control public visibility
    - Update RLS policies to allow public read access for shared pods
  
  2. Security
    - Public access only for pods with `is_public = true`
    - Only pod owners can update sharing settings
    - All other operations remain restricted to members
*/

-- Add sharing columns to pods table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pods' AND column_name = 'share_token'
  ) THEN
    ALTER TABLE pods ADD COLUMN share_token text UNIQUE DEFAULT NULL;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pods' AND column_name = 'is_public'
  ) THEN
    ALTER TABLE pods ADD COLUMN is_public boolean DEFAULT false;
  END IF;
END $$;

-- Create index for share_token lookups
CREATE INDEX IF NOT EXISTS idx_pods_share_token ON pods(share_token) WHERE share_token IS NOT NULL;

-- Drop existing policies if they exist and recreate them
DO $$
BEGIN
  DROP POLICY IF EXISTS "Public can view shared pods" ON pods;
  DROP POLICY IF EXISTS "Public can view insights of shared pods" ON insights;
  DROP POLICY IF EXISTS "Public can view comments of shared pods" ON comments;
  DROP POLICY IF EXISTS "Public can view members of shared pods" ON pod_members;
  DROP POLICY IF EXISTS "Public can view profiles of shared pod members" ON profiles;
END $$;

-- Add policy for public read access to shared pods
CREATE POLICY "Public can view shared pods"
  ON pods FOR SELECT
  TO anon
  USING (is_public = true AND share_token IS NOT NULL);

-- Add policy for public read access to insights of shared pods
CREATE POLICY "Public can view insights of shared pods"
  ON insights FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = insights.pod_id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );

-- Add policy for public read access to comments of shared pods
CREATE POLICY "Public can view comments of shared pods"
  ON comments FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM insights
      INNER JOIN pods ON pods.id = insights.pod_id
      WHERE insights.id = comments.insight_id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );

-- Add policy for public read access to pod members of shared pods
CREATE POLICY "Public can view members of shared pods"
  ON pod_members FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );

-- Add policy for public read access to profiles of members in shared pods
CREATE POLICY "Public can view profiles of shared pod members"
  ON profiles FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      INNER JOIN pods ON pods.id = pod_members.pod_id
      WHERE pod_members.user_id = profiles.id
      AND pods.is_public = true
      AND pods.share_token IS NOT NULL
    )
  );