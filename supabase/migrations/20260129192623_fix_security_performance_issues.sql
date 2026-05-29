/*
  # Fix Security and Performance Issues
  
  ## 1. Performance Improvements
    ### Add Missing Foreign Key Indexes
    - Add index on `comments.author_id` for faster author lookups
    - Add index on `messages.sender_id` for faster sender queries
    - Add index on `reactions.user_id` for faster user reaction queries
    - Add index on `user_challenges.user_id` for faster user challenge lookups
  
  ## 2. RLS Policy Optimization
    ### Marketplace Items Policies
    - Update all marketplace_items policies to use `(select auth.uid())` pattern
    - This prevents re-evaluation of auth.uid() for each row, significantly improving performance at scale
    
    ### Insight Likes Policies
    - Update insight_likes policies to use `(select auth.uid())` pattern
    - Improves query performance by evaluating auth function once per query instead of per row
  
  ## 3. Security Improvements
    ### Fix Multiple Permissive Policies
    - Consolidate marketplace_items SELECT policies into a single restrictive policy
    - Remove redundant "Sellers can view own items" policy (covered by the main SELECT policy)
    
    ### Function Security
    - Set secure search_path on all trigger functions to prevent search_path exploits
    - Functions affected: update_marketplace_items_updated_at, update_insight_like_count, notify_new_follower
  
  ## Notes
  - Unused indexes are retained as they will be valuable as the application scales
  - Auth connection strategy and password protection settings must be configured in Supabase dashboard
  - All changes maintain backward compatibility with existing application code
*/

-- ============================================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- ============================================================================

-- Index for comments.author_id
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);

-- Index for messages.sender_id
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- Index for reactions.user_id
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);

-- Index for user_challenges.user_id
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);

-- ============================================================================
-- 2. OPTIMIZE RLS POLICIES - MARKETPLACE ITEMS
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can create items" ON marketplace_items;
DROP POLICY IF EXISTS "Sellers can update own items" ON marketplace_items;
DROP POLICY IF EXISTS "Sellers can delete own items" ON marketplace_items;
DROP POLICY IF EXISTS "Anyone can view active marketplace items" ON marketplace_items;
DROP POLICY IF EXISTS "Sellers can view own items" ON marketplace_items;

-- Recreate optimized policies with (select auth.uid()) pattern

-- SELECT: Single policy that covers both viewing active items and own items
CREATE POLICY "Users can view active marketplace items or own items"
  ON marketplace_items
  FOR SELECT
  TO authenticated
  USING (
    status = 'active' OR seller_id = (select auth.uid())
  );

-- INSERT: Authenticated users can create items
CREATE POLICY "Authenticated users can create items"
  ON marketplace_items
  FOR INSERT
  TO authenticated
  WITH CHECK (seller_id = (select auth.uid()));

-- UPDATE: Sellers can update their own items
CREATE POLICY "Sellers can update own items"
  ON marketplace_items
  FOR UPDATE
  TO authenticated
  USING (seller_id = (select auth.uid()))
  WITH CHECK (seller_id = (select auth.uid()));

-- DELETE: Sellers can delete their own items
CREATE POLICY "Sellers can delete own items"
  ON marketplace_items
  FOR DELETE
  TO authenticated
  USING (seller_id = (select auth.uid()));

-- ============================================================================
-- 3. OPTIMIZE RLS POLICIES - INSIGHT LIKES
-- ============================================================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can create their own likes" ON insight_likes;
DROP POLICY IF EXISTS "Users can delete their own likes" ON insight_likes;

-- Recreate optimized policies with (select auth.uid()) pattern

-- INSERT: Users can create their own likes
CREATE POLICY "Users can create their own likes"
  ON insight_likes
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- DELETE: Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON insight_likes
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 4. FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Fix update_marketplace_items_updated_at function
CREATE OR REPLACE FUNCTION update_marketplace_items_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_insight_like_count function
CREATE OR REPLACE FUNCTION update_insight_like_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    UPDATE insights
    SET like_count = like_count + 1
    WHERE id = NEW.insight_id;
  ELSIF (TG_OP = 'DELETE') THEN
    UPDATE insights
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = OLD.insight_id;
  END IF;
  RETURN NULL;
END;
$$;

-- Fix notify_new_follower function
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  follower_name text;
BEGIN
  SELECT full_name INTO follower_name
  FROM profiles
  WHERE id = NEW.follower_id;

  INSERT INTO notifications (user_id, type, title, content, actor_id)
  VALUES (
    NEW.following_id,
    'follow',
    'New Follower',
    follower_name || ' started following you',
    NEW.follower_id
  );

  RETURN NEW;
END;
$$;