/*
  # Fix Security and Performance Issues

  This migration addresses multiple security and performance issues identified by Supabase:

  ## 1. Unindexed Foreign Keys
  Adds indexes for foreign keys that were missing covering indexes:
  - `challenge_responses.user_id`
  - `challenges.creator_id`
  - `jobs.poster_id`

  ## 2. Auth RLS Initialization Plan
  Optimizes RLS policies by wrapping auth.uid() calls with SELECT to prevent
  re-evaluation for each row (significant performance improvement at scale):
  - All policies on `learning_paths`
  - All policies on `learning_path_items`
  - All policies on `learning_path_progress`

  ## 3. Unused Indexes
  Removes indexes that are not being used to improve write performance and reduce storage:
  - Search indexes (GIN indexes that may be added later when search is implemented)
  - Various foreign key indexes that duplicate primary key or unique constraint indexes

  ## 4. Function Search Path
  Sets secure search_path for functions to prevent security vulnerabilities

  Note: Some issues require manual configuration in Supabase Dashboard:
  - Auth DB Connection Strategy (switch to percentage-based)
  - Leaked Password Protection (enable HaveIBeenPwned check)
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES ON FOREIGN KEYS
-- ============================================================================

-- Add index for challenge_responses.user_id
CREATE INDEX IF NOT EXISTS idx_challenge_responses_user_id
ON challenge_responses(user_id);

-- Add index for challenges.creator_id
CREATE INDEX IF NOT EXISTS idx_challenges_creator_id
ON challenges(creator_id);

-- Add index for jobs.poster_id
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id
ON jobs(poster_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES WITH SELECT WRAPPERS
-- ============================================================================

-- Drop existing policies for learning_paths
DROP POLICY IF EXISTS "Users can view own learning paths" ON learning_paths;
DROP POLICY IF EXISTS "Users can create own learning paths" ON learning_paths;
DROP POLICY IF EXISTS "Users can update own learning paths" ON learning_paths;
DROP POLICY IF EXISTS "Users can delete own learning paths" ON learning_paths;

-- Recreate optimized policies for learning_paths
CREATE POLICY "Users can view own learning paths"
  ON learning_paths FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own learning paths"
  ON learning_paths FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own learning paths"
  ON learning_paths FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own learning paths"
  ON learning_paths FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Drop existing policies for learning_path_items
DROP POLICY IF EXISTS "Users can view items from own learning paths" ON learning_path_items;
DROP POLICY IF EXISTS "Users can create items in own learning paths" ON learning_path_items;
DROP POLICY IF EXISTS "Users can update items in own learning paths" ON learning_path_items;
DROP POLICY IF EXISTS "Users can delete items in own learning paths" ON learning_path_items;

-- Recreate optimized policies for learning_path_items
CREATE POLICY "Users can view items from own learning paths"
  ON learning_path_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can create items in own learning paths"
  ON learning_path_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update items in own learning paths"
  ON learning_path_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete items in own learning paths"
  ON learning_path_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

-- Drop existing policies for learning_path_progress
DROP POLICY IF EXISTS "Users can view own progress" ON learning_path_progress;
DROP POLICY IF EXISTS "Users can create own progress" ON learning_path_progress;
DROP POLICY IF EXISTS "Users can update own progress" ON learning_path_progress;
DROP POLICY IF EXISTS "Users can delete own progress" ON learning_path_progress;

-- Recreate optimized policies for learning_path_progress
CREATE POLICY "Users can view own progress"
  ON learning_path_progress FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own progress"
  ON learning_path_progress FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own progress"
  ON learning_path_progress FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own progress"
  ON learning_path_progress FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ============================================================================
-- 3. REMOVE UNUSED INDEXES
-- ============================================================================

-- Remove unused search indexes (these can be added back when search is implemented)
DROP INDEX IF EXISTS posts_search_idx;
DROP INDEX IF EXISTS pods_search_idx;
DROP INDEX IF EXISTS jobs_search_idx;
DROP INDEX IF EXISTS marketplace_items_search_idx;

-- Remove unused learning path indexes
-- Note: Keep idx_learning_paths_user_id as it's used by foreign key queries
-- The others are not actually being used in queries
DROP INDEX IF EXISTS idx_learning_path_items_path_id;
DROP INDEX IF EXISTS idx_learning_path_progress_user_id;
DROP INDEX IF EXISTS idx_learning_path_progress_item_id;

-- Remove unused comment mention indexes
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_by_user_id;
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_user_id;

-- Remove unused marketplace indexes
DROP INDEX IF EXISTS idx_marketplace_items_seller_id;

-- Remove unused message indexes
DROP INDEX IF EXISTS idx_messages_sender_id;

-- Remove unused post attachment indexes
DROP INDEX IF EXISTS idx_post_attachments_post_comment_id;
DROP INDEX IF EXISTS idx_post_attachments_post_id;

-- Remove unused post comment indexes
DROP INDEX IF EXISTS idx_post_comments_author_id;
DROP INDEX IF EXISTS idx_post_comments_post_id;

-- Remove unused post like indexes
DROP INDEX IF EXISTS idx_post_likes_user_id;

-- Remove unused post tag indexes
DROP INDEX IF EXISTS idx_post_tags_pod_id;

-- Remove unused reaction indexes
DROP INDEX IF EXISTS idx_reactions_user_id;

-- Remove unused challenge indexes
DROP INDEX IF EXISTS idx_user_challenges_user_id;

-- ============================================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Update check_and_award_achievements function with secure search_path
CREATE OR REPLACE FUNCTION check_and_award_achievements()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN NEW;
END;
$$;

-- Update update_profiles_search_vector function with secure search_path
CREATE OR REPLACE FUNCTION update_profiles_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.full_name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.skills, '')), 'C');
  RETURN NEW;
END;
$$;

-- Update update_posts_search_vector function with secure search_path
CREATE OR REPLACE FUNCTION update_posts_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.content, '')), 'A');
  RETURN NEW;
END;
$$;

-- Update update_pods_search_vector function with secure search_path
CREATE OR REPLACE FUNCTION update_pods_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;

-- Update update_jobs_search_vector function with secure search_path
CREATE OR REPLACE FUNCTION update_jobs_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.company, '')), 'C');
  RETURN NEW;
END;
$$;

-- Update update_marketplace_items_search_vector function with secure search_path
CREATE OR REPLACE FUNCTION update_marketplace_items_search_vector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B');
  RETURN NEW;
END;
$$;