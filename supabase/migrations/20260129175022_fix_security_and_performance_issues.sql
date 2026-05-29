/*
  # Fix Security and Performance Issues

  This migration addresses multiple security and performance concerns:

  ## 1. Foreign Key Indexes
    - Add index on `notifications.actor_id` to improve join performance

  ## 2. RLS Policy Optimization
    - Update notifications policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation of auth function for each row, significantly improving query performance

  ## 3. Remove Unused Indexes
    - Drop indexes that are not being utilized by queries
    - Reduces storage overhead and improves write performance
    - Indexes removed from:
      - user_challenges (idx_user_challenges_user_id)
      - pod_members (idx_pod_members_pod_id)
      - insights (idx_insights_pod_id, idx_insights_created_at)
      - reactions (idx_reactions_insight_id, idx_reactions_user_id, idx_reactions_insight_user)
      - messages (idx_messages_sender_id)
      - comments (idx_comments_author_id, idx_comments_created_at)
      - notifications (idx_notifications_created)

  ## 4. Function Security Hardening
    - Update trigger functions with immutable search_path
    - Prevents search_path hijacking attacks
    - Functions updated:
      - notify_new_message
      - notify_insight_reaction
      - notify_insight_comment

  ## Important Notes
    - Auth DB connection strategy and leaked password protection are configuration settings
    - These must be adjusted in Supabase Dashboard under Settings > Database and Auth
    - Cannot be modified via SQL migrations
*/

-- ==========================================
-- 1. ADD MISSING FOREIGN KEY INDEX
-- ==========================================

-- Add index on actor_id foreign key for better join performance
CREATE INDEX IF NOT EXISTS idx_notifications_actor_id ON notifications(actor_id);

-- ==========================================
-- 2. OPTIMIZE RLS POLICIES
-- ==========================================

-- Drop existing policies
DROP POLICY IF EXISTS "Users can read own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON notifications;

-- Recreate policies with optimized auth.uid() calls
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ==========================================
-- 3. DROP UNUSED INDEXES
-- ==========================================

-- Drop unused indexes to reduce storage and improve write performance
DROP INDEX IF EXISTS idx_user_challenges_user_id;
DROP INDEX IF EXISTS idx_pod_members_pod_id;
DROP INDEX IF EXISTS idx_insights_pod_id;
DROP INDEX IF EXISTS idx_insights_created_at;
DROP INDEX IF EXISTS idx_reactions_insight_id;
DROP INDEX IF EXISTS idx_reactions_user_id;
DROP INDEX IF EXISTS idx_reactions_insight_user;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_comments_author_id;
DROP INDEX IF EXISTS idx_comments_created_at;
DROP INDEX IF EXISTS idx_notifications_created;

-- ==========================================
-- 4. FIX FUNCTION SEARCH PATH SECURITY
-- ==========================================

-- Recreate notify_new_message with immutable search_path
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
BEGIN
  -- Get the other participant in the conversation
  SELECT CASE 
    WHEN user_one_id = NEW.sender_id THEN user_two_id
    ELSE user_one_id
  END INTO recipient_id
  FROM public.conversations
  WHERE id = NEW.conversation_id;

  -- Get sender's name
  SELECT full_name INTO sender_name
  FROM public.profiles
  WHERE id = NEW.sender_id;

  -- Create notification for recipient
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    content,
    related_id,
    related_type,
    actor_id
  )
  VALUES (
    recipient_id,
    'message',
    'New message',
    sender_name || ' sent you a message',
    NEW.conversation_id,
    'conversation',
    NEW.sender_id
  );

  RETURN NEW;
END;
$$;

-- Recreate notify_insight_reaction with immutable search_path
CREATE OR REPLACE FUNCTION notify_insight_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  insight_author_id uuid;
  reactor_name text;
BEGIN
  -- Get insight author
  SELECT author_id INTO insight_author_id
  FROM public.insights
  WHERE id = NEW.insight_id;

  -- Don't notify if user reacted to their own insight
  IF insight_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get reactor's name
  SELECT full_name INTO reactor_name
  FROM public.profiles
  WHERE id = NEW.user_id;

  -- Create notification
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    content,
    related_id,
    related_type,
    actor_id
  )
  VALUES (
    insight_author_id,
    'reaction',
    'New reaction',
    reactor_name || ' reacted to your insight',
    NEW.insight_id,
    'insight',
    NEW.user_id
  );

  RETURN NEW;
END;
$$;

-- Recreate notify_insight_comment with immutable search_path
CREATE OR REPLACE FUNCTION notify_insight_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  insight_author_id uuid;
  commenter_name text;
BEGIN
  -- Get insight author
  SELECT author_id INTO insight_author_id
  FROM public.insights
  WHERE id = NEW.insight_id;

  -- Don't notify if user commented on their own insight
  IF insight_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter's name
  SELECT full_name INTO commenter_name
  FROM public.profiles
  WHERE id = NEW.author_id;

  -- Create notification
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    content,
    related_id,
    related_type,
    actor_id
  )
  VALUES (
    insight_author_id,
    'comment',
    'New comment',
    commenter_name || ' commented on your insight',
    NEW.insight_id,
    'insight',
    NEW.author_id
  );

  RETURN NEW;
END;
$$;