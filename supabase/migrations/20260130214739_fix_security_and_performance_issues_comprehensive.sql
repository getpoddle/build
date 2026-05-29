/*
  # Comprehensive Security and Performance Fixes

  ## Changes
  
  ### 1. Add Missing Indexes for Foreign Keys
  - comment_mentions: mentioned_by_user_id, mentioned_user_id
  - marketplace_items: seller_id
  - messages: sender_id
  - post_attachments: post_comment_id, post_id
  - post_comments: author_id, post_id
  - post_likes: user_id
  - post_tags: pod_id
  - reactions: user_id
  - user_challenges: user_id

  ### 2. Optimize RLS Policies
  - Replace direct auth.uid() calls with (select auth.uid()) for better performance
  - Fix multiple permissive policies on jobs table

  ### 3. Remove Unused Indexes
  - Remove indexes that haven't been used

  ### 4. Fix Function Search Paths
  - Set security definer and search path for all functions
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_by_user_id 
  ON comment_mentions(mentioned_by_user_id);

CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_user_id 
  ON comment_mentions(mentioned_user_id);

CREATE INDEX IF NOT EXISTS idx_marketplace_items_seller_id 
  ON marketplace_items(seller_id);

CREATE INDEX IF NOT EXISTS idx_messages_sender_id 
  ON messages(sender_id);

CREATE INDEX IF NOT EXISTS idx_post_attachments_post_comment_id 
  ON post_attachments(post_comment_id);

CREATE INDEX IF NOT EXISTS idx_post_attachments_post_id 
  ON post_attachments(post_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_author_id 
  ON post_comments(author_id);

CREATE INDEX IF NOT EXISTS idx_post_comments_post_id 
  ON post_comments(post_id);

CREATE INDEX IF NOT EXISTS idx_post_likes_user_id 
  ON post_likes(user_id);

CREATE INDEX IF NOT EXISTS idx_post_tags_pod_id 
  ON post_tags(pod_id);

CREATE INDEX IF NOT EXISTS idx_reactions_user_id 
  ON reactions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id 
  ON user_challenges(user_id);

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_challenges_status_ends_at;
DROP INDEX IF EXISTS idx_challenges_creator_id;
DROP INDEX IF EXISTS idx_challenge_responses_challenge_id;
DROP INDEX IF EXISTS idx_challenge_responses_user_id;
DROP INDEX IF EXISTS idx_challenge_responses_votes_count;
DROP INDEX IF EXISTS idx_challenge_votes_response_id;
DROP INDEX IF EXISTS idx_jobs_poster_id;
DROP INDEX IF EXISTS idx_jobs_status;
DROP INDEX IF EXISTS idx_jobs_category;
DROP INDEX IF EXISTS idx_jobs_created_at;
DROP INDEX IF EXISTS idx_user_skills_category;
DROP INDEX IF EXISTS idx_user_achievements_achievement;
DROP INDEX IF EXISTS idx_user_stats_level;
DROP INDEX IF EXISTS idx_user_interests_interest;
DROP INDEX IF EXISTS idx_learning_paths_status;
DROP INDEX IF EXISTS idx_learning_paths_skill_id;
DROP INDEX IF EXISTS idx_learning_path_steps_path_id;
DROP INDEX IF EXISTS idx_learning_path_steps_step_number;
DROP INDEX IF EXISTS idx_skill_progress_user_id;
DROP INDEX IF EXISTS idx_skill_progress_skill_id;
DROP INDEX IF EXISTS idx_ai_interactions_user_id;
DROP INDEX IF EXISTS idx_ai_interactions_type;
DROP INDEX IF EXISTS idx_ai_interactions_context;
DROP INDEX IF EXISTS idx_content_recommendations_user_id;
DROP INDEX IF EXISTS idx_content_recommendations_content;
DROP INDEX IF EXISTS idx_content_recommendations_shown;

-- ============================================================================
-- 3. OPTIMIZE RLS POLICIES - SKILL_PROGRESS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own skill progress" ON skill_progress;
DROP POLICY IF EXISTS "Users can insert own skill progress" ON skill_progress;

CREATE POLICY "Users can view own skill progress"
  ON skill_progress FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own skill progress"
  ON skill_progress FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES - AI_INTERACTIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own AI interactions" ON ai_interactions;
DROP POLICY IF EXISTS "Users can insert own AI interactions" ON ai_interactions;

CREATE POLICY "Users can view own AI interactions"
  ON ai_interactions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own AI interactions"
  ON ai_interactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 5. OPTIMIZE RLS POLICIES - CONTENT_RECOMMENDATIONS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own recommendations" ON content_recommendations;
DROP POLICY IF EXISTS "Users can insert own recommendations" ON content_recommendations;
DROP POLICY IF EXISTS "Users can update own recommendations" ON content_recommendations;

CREATE POLICY "Users can view own recommendations"
  ON content_recommendations FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own recommendations"
  ON content_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own recommendations"
  ON content_recommendations FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- ============================================================================
-- 6. OPTIMIZE RLS POLICIES - JOBS (FIX MULTIPLE PERMISSIVE POLICIES)
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can view active jobs" ON jobs;
DROP POLICY IF EXISTS "Job posters can view their own jobs" ON jobs;
DROP POLICY IF EXISTS "Authenticated users can create jobs" ON jobs;
DROP POLICY IF EXISTS "Job posters can update their own jobs" ON jobs;
DROP POLICY IF EXISTS "Job posters can delete their own jobs" ON jobs;

CREATE POLICY "Users can view active jobs or own jobs"
  ON jobs FOR SELECT
  TO authenticated
  USING (status = 'active' OR poster_id = (select auth.uid()));

CREATE POLICY "Authenticated users can create jobs"
  ON jobs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Job posters can update their own jobs"
  ON jobs FOR UPDATE
  TO authenticated
  USING (poster_id = (select auth.uid()))
  WITH CHECK (poster_id = (select auth.uid()));

CREATE POLICY "Job posters can delete their own jobs"
  ON jobs FOR DELETE
  TO authenticated
  USING (poster_id = (select auth.uid()));

-- ============================================================================
-- 7. OPTIMIZE RLS POLICIES - LEARNING_PATHS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own learning paths" ON learning_paths;
DROP POLICY IF EXISTS "Users can insert own learning paths" ON learning_paths;
DROP POLICY IF EXISTS "Users can update own learning paths" ON learning_paths;
DROP POLICY IF EXISTS "Users can delete own learning paths" ON learning_paths;

CREATE POLICY "Users can view own learning paths"
  ON learning_paths FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own learning paths"
  ON learning_paths FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own learning paths"
  ON learning_paths FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own learning paths"
  ON learning_paths FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 8. OPTIMIZE RLS POLICIES - LEARNING_PATH_STEPS
-- ============================================================================

DROP POLICY IF EXISTS "Users can view steps of own learning paths" ON learning_path_steps;
DROP POLICY IF EXISTS "Users can insert steps to own learning paths" ON learning_path_steps;
DROP POLICY IF EXISTS "Users can update steps of own learning paths" ON learning_path_steps;
DROP POLICY IF EXISTS "Users can delete steps of own learning paths" ON learning_path_steps;

CREATE POLICY "Users can view steps of own learning paths"
  ON learning_path_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert steps to own learning paths"
  ON learning_path_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update steps of own learning paths"
  ON learning_path_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete steps of own learning paths"
  ON learning_path_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 9. OPTIMIZE RLS POLICIES - CHALLENGES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create challenges" ON challenges;
DROP POLICY IF EXISTS "Creators can update their own challenges" ON challenges;
DROP POLICY IF EXISTS "Creators can delete their own challenges" ON challenges;

CREATE POLICY "Authenticated users can create challenges"
  ON challenges FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Creators can update their own challenges"
  ON challenges FOR UPDATE
  TO authenticated
  USING (creator_id = (select auth.uid()))
  WITH CHECK (creator_id = (select auth.uid()));

CREATE POLICY "Creators can delete their own challenges"
  ON challenges FOR DELETE
  TO authenticated
  USING (creator_id = (select auth.uid()));

-- ============================================================================
-- 10. OPTIMIZE RLS POLICIES - CHALLENGE_RESPONSES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create responses" ON challenge_responses;
DROP POLICY IF EXISTS "Users can update their own responses" ON challenge_responses;
DROP POLICY IF EXISTS "Users can delete their own responses" ON challenge_responses;

CREATE POLICY "Authenticated users can create responses"
  ON challenge_responses FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can update their own responses"
  ON challenge_responses FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete their own responses"
  ON challenge_responses FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 11. OPTIMIZE RLS POLICIES - CHALLENGE_VOTES
-- ============================================================================

DROP POLICY IF EXISTS "Authenticated users can create votes" ON challenge_votes;
DROP POLICY IF EXISTS "Users can delete their own votes" ON challenge_votes;

CREATE POLICY "Authenticated users can create votes"
  ON challenge_votes FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Users can delete their own votes"
  ON challenge_votes FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ============================================================================
-- 12. OPTIMIZE RLS POLICIES - USER_CHALLENGE_STREAKS
-- ============================================================================

DROP POLICY IF EXISTS "System can insert streaks" ON user_challenge_streaks;
DROP POLICY IF EXISTS "System can update streaks" ON user_challenge_streaks;

CREATE POLICY "System can insert streaks"
  ON user_challenge_streaks FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "System can update streaks"
  ON user_challenge_streaks FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL)
  WITH CHECK ((select auth.uid()) IS NOT NULL);

-- ============================================================================
-- 13. FIX FUNCTION SEARCH PATHS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_jobs_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_response_vote_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE challenge_responses
  SET votes_count = (
    SELECT COUNT(*)
    FROM challenge_votes
    WHERE response_id = NEW.response_id
  )
  WHERE id = NEW.response_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_user_challenge_streak()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  streak_record RECORD;
  last_completion_date DATE;
BEGIN
  SELECT * INTO streak_record
  FROM user_challenge_streaks
  WHERE user_id = NEW.user_id
  FOR UPDATE;

  IF streak_record IS NULL THEN
    INSERT INTO user_challenge_streaks (user_id, current_streak, longest_streak, last_completion_date)
    VALUES (NEW.user_id, 1, 1, CURRENT_DATE);
  ELSE
    last_completion_date := streak_record.last_completion_date;
    
    IF CURRENT_DATE = last_completion_date THEN
      RETURN NEW;
    ELSIF CURRENT_DATE = last_completion_date + INTERVAL '1 day' THEN
      UPDATE user_challenge_streaks
      SET 
        current_streak = current_streak + 1,
        longest_streak = GREATEST(longest_streak, current_streak + 1),
        last_completion_date = CURRENT_DATE
      WHERE user_id = NEW.user_id;
    ELSE
      UPDATE user_challenge_streaks
      SET 
        current_streak = 1,
        last_completion_date = CURRENT_DATE
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION check_and_award_achievements()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  achievement_to_award TEXT;
BEGIN
  IF NEW.posts_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = NEW.user_id AND achievement = 'first_post'
  ) THEN
    achievement_to_award := 'first_post';
  ELSIF NEW.posts_count >= 10 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = NEW.user_id AND achievement = 'prolific_poster'
  ) THEN
    achievement_to_award := 'prolific_poster';
  ELSIF NEW.comments_count >= 50 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = NEW.user_id AND achievement = 'conversation_starter'
  ) THEN
    achievement_to_award := 'conversation_starter';
  ELSIF NEW.likes_received >= 100 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = NEW.user_id AND achievement = 'community_favorite'
  ) THEN
    achievement_to_award := 'community_favorite';
  ELSIF NEW.pods_joined >= 5 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = NEW.user_id AND achievement = 'social_butterfly'
  ) THEN
    achievement_to_award := 'social_butterfly';
  ELSIF NEW.challenges_completed >= 10 AND NOT EXISTS (
    SELECT 1 FROM user_achievements WHERE user_id = NEW.user_id AND achievement = 'challenge_master'
  ) THEN
    achievement_to_award := 'challenge_master';
  END IF;

  IF achievement_to_award IS NOT NULL THEN
    INSERT INTO user_achievements (user_id, achievement)
    VALUES (NEW.user_id, achievement_to_award);
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_stats_on_post()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_stats
  SET posts_count = posts_count + 1
  WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_stats_on_comment()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_stats
  SET comments_count = comments_count + 1
  WHERE user_id = NEW.author_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_stats_on_like()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_stats
  SET likes_received = likes_received + 1
  WHERE user_id = (
    SELECT author_id FROM posts WHERE id = NEW.post_id
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_stats_on_pod_join()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_stats
  SET pods_joined = pods_joined + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_stats_on_challenge_response()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE user_stats
  SET challenges_completed = challenges_completed + 1
  WHERE user_id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_achievement_unlock()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, link)
  VALUES (
    NEW.user_id,
    'achievement',
    jsonb_build_object('achievement', NEW.achievement),
    '/achievements'
  );
  RETURN NEW;
END;
$$;
