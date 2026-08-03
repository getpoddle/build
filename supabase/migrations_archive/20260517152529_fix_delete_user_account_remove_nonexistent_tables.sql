/*
  # Fix delete_user_account function

  ## Problem
  The existing function references tables that have been removed (pod_assumptions,
  assumption_forecasts, assumption_risks, assumption_scenarios, assumption_challenges,
  decision_threads and related tables, messages, conversations, pod_members,
  pod_forecasts, pod_options, pod_risks, user_reputation, insight_events,
  insight_likes, assumption_mentions, reactions).

  ## Fix
  Recreate the function referencing only tables that actually exist, ensuring
  admin user deletion works without "relation does not exist" errors.
*/

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_check boolean;
BEGIN
  -- Verify caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  ) INTO admin_check;

  IF NOT admin_check THEN
    RAISE EXCEPTION 'Only admins can delete user accounts';
  END IF;

  -- Delete challenges and responses
  DELETE FROM challenges WHERE creator_id = target_user_id;
  DELETE FROM challenge_responses WHERE user_id = target_user_id;
  DELETE FROM challenge_votes WHERE user_id = target_user_id;

  -- Delete posts and comments
  DELETE FROM post_likes WHERE user_id = target_user_id;
  DELETE FROM post_comments WHERE author_id = target_user_id;
  DELETE FROM comments WHERE author_id = target_user_id;
  DELETE FROM posts WHERE author_id = target_user_id;

  -- Delete notifications
  DELETE FROM notifications WHERE user_id = target_user_id OR actor_id = target_user_id;

  -- Delete social connections
  DELETE FROM followers WHERE follower_id = target_user_id OR following_id = target_user_id;

  -- Delete marketplace items
  DELETE FROM marketplace_items WHERE seller_id = target_user_id;

  -- Delete referrals and invites
  DELETE FROM referral_codes WHERE user_id = target_user_id;
  DELETE FROM referral_rewards WHERE user_id = target_user_id;

  -- Delete blocks
  DELETE FROM user_blocks WHERE blocker_id = target_user_id OR blocked_id = target_user_id;

  -- Delete user stats and activity
  DELETE FROM user_stats WHERE user_id = target_user_id;
  DELETE FROM user_challenges WHERE user_id = target_user_id;
  DELETE FROM user_challenge_streaks WHERE user_id = target_user_id;
  DELETE FROM user_interests WHERE user_id = target_user_id;
  DELETE FROM user_skills WHERE user_id = target_user_id;

  -- Delete learning paths
  DELETE FROM learning_paths WHERE user_id = target_user_id;
  DELETE FROM learning_path_progress WHERE user_id = target_user_id;

  -- Delete comment-level activity
  DELETE FROM forecast_comments WHERE user_id = target_user_id;
  DELETE FROM risk_comments WHERE user_id = target_user_id;
  DELETE FROM scenario_comments WHERE user_id = target_user_id;

  -- Delete mentions
  DELETE FROM assumption_comment_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_response_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM comment_mentions WHERE mentioned_user_id = target_user_id;

  -- Delete entity challenges authored by user
  DELETE FROM entity_challenges WHERE created_by = target_user_id;

  -- Delete profile (CASCADE handles user_account_status, moderation_actions, content_reports)
  DELETE FROM profiles WHERE id = target_user_id;

  -- Finally delete from auth.users
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
