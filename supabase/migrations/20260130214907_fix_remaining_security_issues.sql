/*
  # Fix Remaining Security and Performance Issues

  ## Changes
  
  ### 1. Add Missing Indexes for Foreign Keys
  - ai_interactions: user_id
  - challenge_responses: user_id
  - challenges: creator_id
  - content_recommendations: user_id
  - jobs: poster_id
  - learning_path_steps: learning_path_id
  - learning_paths: skill_id
  - skill_progress: skill_id, user_id
  - user_achievements: achievement_id

  ### 2. Remove Unused Indexes
  - Remove indexes that were added but haven't been used

  ### 3. Fix Function Search Path
  - Fix check_and_award_achievements function security
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id_fk 
  ON ai_interactions(user_id);

CREATE INDEX IF NOT EXISTS idx_challenge_responses_user_id_fk 
  ON challenge_responses(user_id);

CREATE INDEX IF NOT EXISTS idx_challenges_creator_id_fk 
  ON challenges(creator_id);

CREATE INDEX IF NOT EXISTS idx_content_recommendations_user_id_fk 
  ON content_recommendations(user_id);

CREATE INDEX IF NOT EXISTS idx_jobs_poster_id_fk 
  ON jobs(poster_id);

CREATE INDEX IF NOT EXISTS idx_learning_path_steps_learning_path_id_fk 
  ON learning_path_steps(learning_path_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_skill_id_fk 
  ON learning_paths(skill_id);

CREATE INDEX IF NOT EXISTS idx_skill_progress_skill_id_fk 
  ON skill_progress(skill_id);

CREATE INDEX IF NOT EXISTS idx_skill_progress_user_id_fk 
  ON skill_progress(user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement_id_fk 
  ON user_achievements(achievement_id);

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_marketplace_items_seller_id;
DROP INDEX IF EXISTS idx_messages_sender_id;
DROP INDEX IF EXISTS idx_post_attachments_post_comment_id;
DROP INDEX IF EXISTS idx_post_attachments_post_id;
DROP INDEX IF EXISTS idx_post_comments_author_id;
DROP INDEX IF EXISTS idx_post_comments_post_id;
DROP INDEX IF EXISTS idx_post_likes_user_id;
DROP INDEX IF EXISTS idx_post_tags_pod_id;
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_by_user_id;
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_user_id;
DROP INDEX IF EXISTS idx_reactions_user_id;
DROP INDEX IF EXISTS idx_user_challenges_user_id;

-- ============================================================================
-- 3. FIX FUNCTION SEARCH PATH
-- ============================================================================

CREATE OR REPLACE FUNCTION check_and_award_achievements()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  achievement_to_award TEXT;
BEGIN
  IF NEW.posts_count >= 1 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement = 'first_post'
  ) THEN
    achievement_to_award := 'first_post';
  ELSIF NEW.posts_count >= 10 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement = 'prolific_poster'
  ) THEN
    achievement_to_award := 'prolific_poster';
  ELSIF NEW.comments_count >= 50 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement = 'conversation_starter'
  ) THEN
    achievement_to_award := 'conversation_starter';
  ELSIF NEW.likes_received >= 100 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement = 'community_favorite'
  ) THEN
    achievement_to_award := 'community_favorite';
  ELSIF NEW.pods_joined >= 5 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement = 'social_butterfly'
  ) THEN
    achievement_to_award := 'social_butterfly';
  ELSIF NEW.challenges_completed >= 10 AND NOT EXISTS (
    SELECT 1 FROM public.user_achievements WHERE user_id = NEW.user_id AND achievement = 'challenge_master'
  ) THEN
    achievement_to_award := 'challenge_master';
  END IF;

  IF achievement_to_award IS NOT NULL THEN
    INSERT INTO public.user_achievements (user_id, achievement)
    VALUES (NEW.user_id, achievement_to_award);
  END IF;

  RETURN NEW;
END;
$$;
