/*
  # Fix Security and Performance Issues

  1. Indexes
    - Add missing index on messages.sender_id foreign key for optimal query performance
  
  2. RLS Policy Optimization
    - Update all RLS policies to use (select auth.uid()) instead of auth.uid()
    - This prevents re-evaluation of auth functions for each row, improving performance at scale
    - Affects tables: conversations, messages, user_challenges, user_interests, user_skills
  
  3. Function Security
    - Add SECURITY DEFINER and explicit search_path to all functions
    - Prevents security vulnerabilities from mutable search paths
    - Affects: update_conversation_timestamp, update_insight_comment_count, sync_all_comment_counts

  Note: Auth DB Connection Strategy and Leaked Password Protection are project-level settings
  that must be configured in the Supabase Dashboard, not via SQL migrations.
*/

-- =====================================================
-- 1. Add Missing Index on messages.sender_id
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);

-- =====================================================
-- 2. Fix RLS Policies - Conversations Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view their own conversations" ON conversations;
CREATE POLICY "Users can view their own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (user_one_id = (select auth.uid()) OR user_two_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (user_one_id = (select auth.uid()) OR user_two_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their conversation timestamps" ON conversations;
CREATE POLICY "Users can update their conversation timestamps"
  ON conversations FOR UPDATE
  TO authenticated
  USING (user_one_id = (select auth.uid()) OR user_two_id = (select auth.uid()))
  WITH CHECK (user_one_id = (select auth.uid()) OR user_two_id = (select auth.uid()));

-- =====================================================
-- 3. Fix RLS Policies - Messages Table
-- =====================================================

DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations"
  ON messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = (select auth.uid()) OR conversations.user_two_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON messages;
CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = conversation_id
      AND (conversations.user_one_id = (select auth.uid()) OR conversations.user_two_id = (select auth.uid()))
    )
  );

DROP POLICY IF EXISTS "Users can mark messages as read in their conversations" ON messages;
CREATE POLICY "Users can mark messages as read in their conversations"
  ON messages FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = (select auth.uid()) OR conversations.user_two_id = (select auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
      AND (conversations.user_one_id = (select auth.uid()) OR conversations.user_two_id = (select auth.uid()))
    )
  );

-- =====================================================
-- 4. Fix RLS Policies - User Challenges Table
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own challenges" ON user_challenges;
CREATE POLICY "Users can insert own challenges"
  ON user_challenges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own challenges" ON user_challenges;
CREATE POLICY "Users can update own challenges"
  ON user_challenges FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own challenges" ON user_challenges;
CREATE POLICY "Users can delete own challenges"
  ON user_challenges FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 5. Fix RLS Policies - User Interests Table
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own interests" ON user_interests;
CREATE POLICY "Users can insert own interests"
  ON user_interests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own interests" ON user_interests;
CREATE POLICY "Users can update own interests"
  ON user_interests FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own interests" ON user_interests;
CREATE POLICY "Users can delete own interests"
  ON user_interests FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 6. Fix RLS Policies - User Skills Table
-- =====================================================

DROP POLICY IF EXISTS "Users can insert own skills" ON user_skills;
CREATE POLICY "Users can insert own skills"
  ON user_skills FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own skills" ON user_skills;
CREATE POLICY "Users can update own skills"
  ON user_skills FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own skills" ON user_skills;
CREATE POLICY "Users can delete own skills"
  ON user_skills FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 7. Fix Function Security - Update Conversation Timestamp
-- =====================================================

CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$;

-- =====================================================
-- 8. Fix Function Security - Update Insight Comment Count
-- =====================================================

CREATE OR REPLACE FUNCTION update_insight_comment_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE insights
    SET comment_count = comment_count + 1
    WHERE id = NEW.insight_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE insights
    SET comment_count = GREATEST(0, comment_count - 1)
    WHERE id = OLD.insight_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- =====================================================
-- 9. Fix Function Security - Sync All Comment Counts
-- =====================================================

CREATE OR REPLACE FUNCTION sync_all_comment_counts()
RETURNS void
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE insights
  SET comment_count = (
    SELECT COUNT(*)
    FROM comments
    WHERE comments.insight_id = insights.id
  );
END;
$$;