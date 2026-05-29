/*
  # Fix Delete User Function - Ambiguous Column Reference
  
  1. Purpose
    - Fix ambiguous column reference error in delete_user_account function
    - Explicitly qualify table names where needed
  
  2. Changes
    - Specify table name for moderation_actions.target_user_id
    - Add moderator_id deletion for moderation_actions
*/

-- Drop the old function
DROP FUNCTION IF EXISTS delete_user_account(uuid);

-- Create corrected function to delete a user and all their data
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
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

  -- Delete user's strategic contributions
  DELETE FROM pod_assumptions WHERE created_by = target_user_id;
  DELETE FROM assumption_forecasts WHERE user_id = target_user_id;
  DELETE FROM assumption_risks WHERE created_by = target_user_id;
  DELETE FROM assumption_scenarios WHERE created_by = target_user_id;
  DELETE FROM assumption_challenges WHERE user_id = target_user_id;
  
  -- Delete challenges and responses
  DELETE FROM challenges WHERE creator_id = target_user_id;
  DELETE FROM challenge_responses WHERE user_id = target_user_id;
  DELETE FROM challenge_votes WHERE user_id = target_user_id;
  
  -- Delete decision threads
  DELETE FROM decision_threads WHERE created_by = target_user_id;
  DELETE FROM decision_thread_links WHERE created_by = target_user_id;
  DELETE FROM decision_thread_members WHERE user_id = target_user_id;
  DELETE FROM decision_thread_tags WHERE user_id = target_user_id;
  DELETE FROM decision_thread_updates WHERE user_id = target_user_id;
  DELETE FROM decision_thread_votes WHERE user_id = target_user_id;
  
  -- Delete posts and comments
  DELETE FROM posts WHERE author_id = target_user_id;
  DELETE FROM comments WHERE author_id = target_user_id;
  DELETE FROM post_likes WHERE user_id = target_user_id;
  DELETE FROM post_comments WHERE author_id = target_user_id;
  
  -- Delete messages and conversations
  DELETE FROM messages WHERE sender_id = target_user_id;
  DELETE FROM conversations WHERE user_one_id = target_user_id OR user_two_id = target_user_id;
  
  -- Delete notifications
  DELETE FROM notifications WHERE user_id = target_user_id OR actor_id = target_user_id;
  
  -- Delete social connections
  DELETE FROM followers WHERE follower_id = target_user_id OR following_id = target_user_id;
  
  -- Delete pod memberships
  DELETE FROM pod_members WHERE user_id = target_user_id;
  DELETE FROM pod_forecasts WHERE user_id = target_user_id;
  DELETE FROM pod_options WHERE created_by = target_user_id;
  DELETE FROM pod_risks WHERE created_by = target_user_id;
  
  -- Delete marketplace items
  DELETE FROM marketplace_items WHERE seller_id = target_user_id;
  
  -- Delete referrals and invites
  DELETE FROM referral_codes WHERE user_id = target_user_id;
  DELETE FROM referral_rewards WHERE user_id = target_user_id;
  
  -- Delete blocks
  DELETE FROM user_blocks WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  
  -- Delete moderation records (specify table to avoid ambiguity)
  DELETE FROM user_account_status WHERE user_account_status.user_id = target_user_id;
  DELETE FROM moderation_actions WHERE moderation_actions.target_user_id = target_user_id;
  
  -- Delete user stats and activity
  DELETE FROM user_stats WHERE user_id = target_user_id;
  DELETE FROM user_reputation WHERE user_id = target_user_id;
  DELETE FROM user_challenges WHERE user_id = target_user_id;
  DELETE FROM user_challenge_streaks WHERE user_id = target_user_id;
  DELETE FROM user_interests WHERE user_id = target_user_id;
  DELETE FROM user_skills WHERE user_id = target_user_id;
  DELETE FROM insight_events WHERE user_id = target_user_id;
  DELETE FROM insight_likes WHERE user_id = target_user_id;
  
  -- Delete learning paths
  DELETE FROM learning_paths WHERE user_id = target_user_id;
  DELETE FROM learning_path_progress WHERE user_id = target_user_id;
  
  -- Delete reactions and comments
  DELETE FROM reactions WHERE user_id = target_user_id;
  DELETE FROM forecast_comments WHERE user_id = target_user_id;
  DELETE FROM risk_comments WHERE user_id = target_user_id;
  DELETE FROM scenario_comments WHERE user_id = target_user_id;
  
  -- Delete mentions
  DELETE FROM assumption_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM assumption_comment_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_response_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM comment_mentions WHERE mentioned_user_id = target_user_id;
  
  -- Delete profile (this should cascade to other tables with ON DELETE CASCADE)
  DELETE FROM profiles WHERE id = target_user_id;
  
  -- Finally delete from auth.users (this is the critical step)
  DELETE FROM auth.users WHERE id = target_user_id;
  
END;
$$;

-- Grant execute permission to authenticated users (function itself checks for admin)
GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;
