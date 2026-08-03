/*
  # Fix RLS Performance and Security Issues

  ## Performance Optimizations
  1. Update all RLS policies to use `(select auth.uid())` instead of `auth.uid()`
     - This prevents re-evaluation of auth functions for each row
     - Significantly improves query performance at scale
  
  ## Security Fixes
  1. Fix function search paths for trigger functions
     - Prevents search_path manipulation attacks
     - Ensures functions use consistent schema resolution

  ## Tables Updated
  - posts (3 policies)
  - post_tags (2 policies)
  - post_attachments (2 policies)
  - post_comments (3 policies)
  - post_likes (2 policies)
  - pod_members (1 policy)

  ## Functions Updated
  - update_post_like_count
  - update_post_comment_count
*/

-- =====================================================
-- Fix RLS Policies for Performance
-- =====================================================

-- posts table policies
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
CREATE POLICY "Users can create their own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
CREATE POLICY "Users can update their own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;
CREATE POLICY "Users can delete their own posts"
  ON posts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = author_id);

-- post_tags table policies
DROP POLICY IF EXISTS "Post authors can create tags for their posts" ON post_tags;
CREATE POLICY "Post authors can create tags for their posts"
  ON post_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
      AND posts.author_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Post authors can delete tags from their posts" ON post_tags;
CREATE POLICY "Post authors can delete tags from their posts"
  ON post_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_tags.post_id
      AND posts.author_id = (select auth.uid())
    )
  );

-- post_attachments table policies
DROP POLICY IF EXISTS "Users can create attachments for their posts" ON post_attachments;
CREATE POLICY "Users can create attachments for their posts"
  ON post_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_attachments.post_id
      AND posts.author_id = (select auth.uid())
    ))
    OR
    (post_comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM post_comments
      WHERE post_comments.id = post_attachments.post_comment_id
      AND post_comments.author_id = (select auth.uid())
    ))
  );

DROP POLICY IF EXISTS "Users can delete their own post attachments" ON post_attachments;
CREATE POLICY "Users can delete their own post attachments"
  ON post_attachments FOR DELETE
  TO authenticated
  USING (
    (post_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_attachments.post_id
      AND posts.author_id = (select auth.uid())
    ))
    OR
    (post_comment_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM post_comments
      WHERE post_comments.id = post_attachments.post_comment_id
      AND post_comments.author_id = (select auth.uid())
    ))
  );

-- post_comments table policies
DROP POLICY IF EXISTS "Users can create post comments" ON post_comments;
CREATE POLICY "Users can create post comments"
  ON post_comments FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Users can update their own post comments" ON post_comments;
CREATE POLICY "Users can update their own post comments"
  ON post_comments FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = author_id)
  WITH CHECK ((select auth.uid()) = author_id);

DROP POLICY IF EXISTS "Users can delete their own post comments" ON post_comments;
CREATE POLICY "Users can delete their own post comments"
  ON post_comments FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = author_id);

-- post_likes table policies
DROP POLICY IF EXISTS "Users can create their own post likes" ON post_likes;
CREATE POLICY "Users can create their own post likes"
  ON post_likes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own post likes" ON post_likes;
CREATE POLICY "Users can delete their own post likes"
  ON post_likes FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- pod_members table policies
DROP POLICY IF EXISTS "Users can view pod memberships" ON pod_members;
CREATE POLICY "Users can view pod memberships"
  ON pod_members FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid())
    OR
    pod_id IN (
      SELECT pod_id FROM pod_members WHERE user_id = (select auth.uid())
    )
  );

-- =====================================================
-- Fix Function Search Paths for Security
-- =====================================================

-- Recreate update_post_like_count with secure search_path
CREATE OR REPLACE FUNCTION update_post_like_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET like_count = like_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET like_count = GREATEST(0, like_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recreate update_post_comment_count with secure search_path
CREATE OR REPLACE FUNCTION update_post_comment_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts
    SET comment_count = comment_count + 1
    WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;
