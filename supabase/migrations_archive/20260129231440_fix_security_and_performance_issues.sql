/*
  # Fix Security and Performance Issues

  ## Changes Made

  ### 1. Add Missing Indexes
    - Add index on `comment_mentions.mentioned_by_user_id` for foreign key optimization
  
  ### 2. Fix RLS Auth Function Calls
    - Update all `comment_mentions` policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth functions for each row, improving performance
  
  ### 3. Consolidate Multiple Permissive Policies
    - Merge duplicate SELECT policies on:
      - `comments` (merge "Authenticated can view comments of shared pods" and "Users can view all comments")
      - `insights` (merge "Authenticated can view insights of shared pods" and "Users can view all insights")
      - `pod_members` (merge "Authenticated can view members of shared pods" and "Users can view all pod memberships")
      - `pods` (merge "Anyone can view pods" and "Authenticated can view shared pods")
      - `profiles` (merge "Authenticated can view profiles of shared pod members" and "Users can view all profiles")
  
  ### 4. Fix Function Search Path
    - Make `create_mention_notification` function have an immutable search path
  
  ### 5. Remove Unused Indexes
    - Keep indexes as they may be used in future queries and provide query planner options

  ## Security
    - All changes maintain existing security posture while improving performance
    - RLS policies remain restrictive and properly authenticated
*/

-- 1. Add missing index for comment_mentions.mentioned_by_user_id
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_by_user 
  ON comment_mentions(mentioned_by_user_id);

-- 2. Fix RLS policies on comment_mentions to use (select auth.uid())

-- Drop existing policies
DROP POLICY IF EXISTS "Users can view mentions they are involved in" ON comment_mentions;
DROP POLICY IF EXISTS "Authenticated users can create mentions" ON comment_mentions;
DROP POLICY IF EXISTS "Users can delete their own mentions" ON comment_mentions;

-- Recreate with optimized auth function calls
CREATE POLICY "Users can view mentions they are involved in"
  ON comment_mentions FOR SELECT
  TO authenticated
  USING (
    mentioned_user_id = (select auth.uid()) OR 
    mentioned_by_user_id = (select auth.uid())
  );

CREATE POLICY "Authenticated users can create mentions"
  ON comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own mentions"
  ON comment_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = (select auth.uid()));

-- 3. Consolidate multiple permissive SELECT policies

-- Fix comments table (comments -> insights -> pods)
DROP POLICY IF EXISTS "Authenticated can view comments of shared pods" ON comments;
DROP POLICY IF EXISTS "Users can view all comments" ON comments;

CREATE POLICY "Authenticated users can view comments"
  ON comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM insights
      JOIN pod_members ON pod_members.pod_id = insights.pod_id
      WHERE insights.id = comments.insight_id
      AND pod_members.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM insights
      JOIN pods ON pods.id = insights.pod_id
      WHERE insights.id = comments.insight_id
      AND pods.share_token IS NOT NULL
    )
  );

-- Fix insights table
DROP POLICY IF EXISTS "Authenticated can view insights of shared pods" ON insights;
DROP POLICY IF EXISTS "Users can view all insights" ON insights;

CREATE POLICY "Authenticated users can view insights"
  ON insights FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = insights.pod_id
      AND pod_members.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = insights.pod_id
      AND pods.share_token IS NOT NULL
    )
  );

-- Fix pod_members table
DROP POLICY IF EXISTS "Authenticated can view members of shared pods" ON pod_members;
DROP POLICY IF EXISTS "Users can view all pod memberships" ON pod_members;

CREATE POLICY "Authenticated users can view pod members"
  ON pod_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM pod_members pm
      WHERE pm.pod_id = pod_members.pod_id
      AND pm.user_id = (select auth.uid())
    )
    OR
    EXISTS (
      SELECT 1 FROM pods
      WHERE pods.id = pod_members.pod_id
      AND pods.share_token IS NOT NULL
    )
  );

-- Fix pods table
DROP POLICY IF EXISTS "Anyone can view pods" ON pods;
DROP POLICY IF EXISTS "Authenticated can view shared pods" ON pods;

CREATE POLICY "Authenticated users can view pods"
  ON pods FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = pods.id
      AND pod_members.user_id = (select auth.uid())
    )
    OR
    share_token IS NOT NULL
  );

-- Fix profiles table
DROP POLICY IF EXISTS "Authenticated can view profiles of shared pod members" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

CREATE POLICY "Authenticated users can view profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    id = (select auth.uid())
    OR
    EXISTS (
      SELECT 1 FROM pod_members pm1
      JOIN pod_members pm2 ON pm1.pod_id = pm2.pod_id
      WHERE pm1.user_id = (select auth.uid())
      AND pm2.user_id = profiles.id
    )
    OR
    EXISTS (
      SELECT 1 FROM pod_members pm
      JOIN pods ON pm.pod_id = pods.id
      WHERE pm.user_id = profiles.id
      AND pods.share_token IS NOT NULL
    )
  );

-- 4. Fix function search path by recreating with explicit schema references
DROP FUNCTION IF EXISTS create_mention_notification CASCADE;

CREATE OR REPLACE FUNCTION public.create_mention_notification()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, auth
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    content,
    related_user_id,
    related_comment_id
  )
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    'mentioned you in a comment',
    NEW.mentioned_by_user_id,
    NEW.comment_id
  );
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_comment_mention_created ON comment_mentions;

CREATE TRIGGER on_comment_mention_created
  AFTER INSERT ON comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notification();
