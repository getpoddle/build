/*
  # Fix RLS: Allow Reading AI-Generated Entities

  AI-generated problems, ideas, and predictions have pod_id = NULL and
  created_by = NULL. The existing RLS policies only allowed reading entities
  in pods the user belongs to or public pods, which excluded all AI content.

  This migration updates the SELECT policies to also allow reading entities
  where pod_id IS NULL (global AI-generated content).

  1. Changes
    - Drop existing SELECT policies on problems, ideas, predictions for authenticated users
    - Create new SELECT policies that include pod_id IS NULL condition
    - Drop existing anon SELECT policies
    - Create new anon SELECT policies that include pod_id IS NULL condition
*/

-- Fix problems SELECT for authenticated
DROP POLICY IF EXISTS "Authenticated users can read problems" ON problems;
CREATE POLICY "Authenticated users can read problems"
  ON problems FOR SELECT
  TO authenticated
  USING (
    pod_id IS NULL
    OR pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

-- Fix problems SELECT for anon
DROP POLICY IF EXISTS "Anyone can read problems in public pods" ON problems;
CREATE POLICY "Anyone can read problems in public pods"
  ON problems FOR SELECT
  TO anon
  USING (
    pod_id IS NULL
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

-- Fix ideas SELECT for authenticated
DROP POLICY IF EXISTS "Authenticated users can read ideas" ON ideas;
CREATE POLICY "Authenticated users can read ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (
    pod_id IS NULL
    OR pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

-- Fix ideas SELECT for anon
DROP POLICY IF EXISTS "Anyone can read ideas in public pods" ON ideas;
CREATE POLICY "Anyone can read ideas in public pods"
  ON ideas FOR SELECT
  TO anon
  USING (
    pod_id IS NULL
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

-- Fix predictions SELECT for authenticated
DROP POLICY IF EXISTS "Authenticated users can read predictions" ON predictions;
CREATE POLICY "Authenticated users can read predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    pod_id IS NULL
    OR pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

-- Fix predictions SELECT for anon
DROP POLICY IF EXISTS "Anyone can read predictions in public pods" ON predictions;
CREATE POLICY "Anyone can read predictions in public pods"
  ON predictions FOR SELECT
  TO anon
  USING (
    pod_id IS NULL
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );