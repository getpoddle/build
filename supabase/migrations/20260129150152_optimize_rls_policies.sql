/*
  # Optimize RLS Policies for Performance

  ## Overview
  This migration optimizes all Row Level Security (RLS) policies to improve query performance
  at scale by wrapping auth.uid() calls with SELECT statements.

  ## Changes Made

  ### 1. Profiles Table Policies
  - Optimized "Users can update own profile" policy
  - Optimized "Users can insert own profile" policy

  ### 2. User Skills Table Policies
  - Optimized "Users can manage own skills" policy

  ### 3. User Interests Table Policies
  - Optimized "Users can manage own interests" policy

  ### 4. User Challenges Table Policies
  - Optimized "Users can manage own challenges" policy

  ### 5. Pod Members Table Policies
  - Optimized "Users can join pods" policy
  - Optimized "Users can leave pods" policy

  ### 6. Insights Table Policies
  - Optimized "Users can create insights in joined pods" policy
  - Optimized "Authors can update own insights" policy
  - Optimized "Authors can delete own insights" policy

  ### 7. Reactions Table Policies
  - Optimized "Users can add reactions" policy
  - Optimized "Users can remove own reactions" policy

  ### 8. Comments Table Policies
  - Optimized "Users can create comments" policy
  - Optimized "Authors can update own comments" policy
  - Optimized "Authors can delete own comments" policy

  ## Performance Impact
  By using (select auth.uid()), the auth function is evaluated once per query instead of
  once per row, significantly improving query performance at scale.
*/

-- Profiles table policies
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (select auth.uid()))
  WITH CHECK (id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = (select auth.uid()));

-- User skills table policies
DROP POLICY IF EXISTS "Users can manage own skills" ON user_skills;
CREATE POLICY "Users can manage own skills"
  ON user_skills
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- User interests table policies
DROP POLICY IF EXISTS "Users can manage own interests" ON user_interests;
CREATE POLICY "Users can manage own interests"
  ON user_interests
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- User challenges table policies
DROP POLICY IF EXISTS "Users can manage own challenges" ON user_challenges;
CREATE POLICY "Users can manage own challenges"
  ON user_challenges
  FOR ALL
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- Pod members table policies
DROP POLICY IF EXISTS "Users can join pods" ON pod_members;
CREATE POLICY "Users can join pods"
  ON pod_members
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can leave pods" ON pod_members;
CREATE POLICY "Users can leave pods"
  ON pod_members
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Insights table policies
DROP POLICY IF EXISTS "Users can create insights in joined pods" ON insights;
CREATE POLICY "Users can create insights in joined pods"
  ON insights
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = insights.pod_id
      AND pod_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors can update own insights" ON insights;
CREATE POLICY "Authors can update own insights"
  ON insights
  FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can delete own insights" ON insights;
CREATE POLICY "Authors can delete own insights"
  ON insights
  FOR DELETE
  TO authenticated
  USING (author_id = (select auth.uid()));

-- Reactions table policies
DROP POLICY IF EXISTS "Users can add reactions" ON reactions;
CREATE POLICY "Users can add reactions"
  ON reactions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can remove own reactions" ON reactions;
CREATE POLICY "Users can remove own reactions"
  ON reactions
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Comments table policies
DROP POLICY IF EXISTS "Users can create comments" ON comments;
CREATE POLICY "Users can create comments"
  ON comments
  FOR INSERT
  TO authenticated
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can update own comments" ON comments;
CREATE POLICY "Authors can update own comments"
  ON comments
  FOR UPDATE
  TO authenticated
  USING (author_id = (select auth.uid()))
  WITH CHECK (author_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can delete own comments" ON comments;
CREATE POLICY "Authors can delete own comments"
  ON comments
  FOR DELETE
  TO authenticated
  USING (author_id = (select auth.uid()));