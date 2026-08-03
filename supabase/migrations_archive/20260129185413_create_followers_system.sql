/*
  # Create Followers/Following System

  ## Overview
  This migration creates a comprehensive followers system that allows users to follow each other
  as friends, enabling social interactions and personalized content feeds.

  ## Changes Made

  ### 1. New Tables
  - `followers`
    - `id` (uuid, primary key) - Unique identifier for the follow relationship
    - `follower_id` (uuid, foreign key to profiles.id) - The user who is following
    - `following_id` (uuid, foreign key to profiles.id) - The user being followed
    - `created_at` (timestamptz) - When the follow relationship was created

  ### 2. Constraints
  - Unique constraint on (follower_id, following_id) to prevent duplicate follows
  - Check constraint to prevent users from following themselves
  - Foreign key constraints with CASCADE delete

  ### 3. Indexes
  - Index on follower_id for fast "who am I following" queries
  - Index on following_id for fast "who follows me" queries
  - Composite index on (follower_id, following_id) for fast relationship checks

  ### 4. Security (RLS Policies)
  - Enable RLS on followers table
  - Authenticated users can view all follow relationships (for displaying follower counts)
  - Users can follow others (INSERT)
  - Users can unfollow (DELETE their own follows only)

  ### 5. Helper Functions
  - Function to get follower count for a user
  - Function to get following count for a user
  - Function to check if user A follows user B
*/

-- =====================================================
-- 1. Create Followers Table
-- =====================================================

CREATE TABLE IF NOT EXISTS followers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  
  -- Prevent duplicate follows
  UNIQUE(follower_id, following_id),
  
  -- Prevent self-follows
  CHECK (follower_id != following_id)
);

-- =====================================================
-- 2. Create Indexes for Performance
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_followers_follower_id ON followers(follower_id);
CREATE INDEX IF NOT EXISTS idx_followers_following_id ON followers(following_id);
CREATE INDEX IF NOT EXISTS idx_followers_relationship ON followers(follower_id, following_id);

-- =====================================================
-- 3. Enable RLS
-- =====================================================

ALTER TABLE followers ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. Create RLS Policies
-- =====================================================

-- Allow all authenticated users to view follow relationships
-- This is needed to display follower/following counts and check follow status
CREATE POLICY "Authenticated users can view all follows"
  ON followers FOR SELECT
  TO authenticated
  USING (true);

-- Users can follow other users
CREATE POLICY "Users can follow others"
  ON followers FOR INSERT
  TO authenticated
  WITH CHECK (follower_id = (select auth.uid()));

-- Users can unfollow (delete their own follows)
CREATE POLICY "Users can unfollow"
  ON followers FOR DELETE
  TO authenticated
  USING (follower_id = (select auth.uid()));

-- =====================================================
-- 5. Create Helper Functions
-- =====================================================

-- Get follower count for a user
CREATE OR REPLACE FUNCTION get_follower_count(user_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*)::integer INTO count_result
  FROM followers
  WHERE following_id = user_id;
  
  RETURN COALESCE(count_result, 0);
END;
$$;

-- Get following count for a user
CREATE OR REPLACE FUNCTION get_following_count(user_id uuid)
RETURNS integer
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  count_result integer;
BEGIN
  SELECT COUNT(*)::integer INTO count_result
  FROM followers
  WHERE follower_id = user_id;
  
  RETURN COALESCE(count_result, 0);
END;
$$;

-- Check if user A follows user B
CREATE OR REPLACE FUNCTION is_following(follower_user_id uuid, following_user_id uuid)
RETURNS boolean
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  result boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM followers
    WHERE follower_id = follower_user_id
    AND following_id = following_user_id
  ) INTO result;
  
  RETURN COALESCE(result, false);
END;
$$;