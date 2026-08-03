/*
  # Fix delete_user_account — entity_challenges uses user_id not created_by
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
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  ) INTO admin_check;

  IF NOT admin_check THEN
    RAISE EXCEPTION 'Only admins can delete user accounts';
  END IF;

  DELETE FROM challenges WHERE creator_id = target_user_id;
  DELETE FROM challenge_responses WHERE user_id = target_user_id;
  DELETE FROM challenge_votes WHERE user_id = target_user_id;

  DELETE FROM post_likes WHERE user_id = target_user_id;
  DELETE FROM post_comments WHERE author_id = target_user_id;
  DELETE FROM comments WHERE author_id = target_user_id;
  DELETE FROM posts WHERE author_id = target_user_id;

  DELETE FROM notifications WHERE user_id = target_user_id OR actor_id = target_user_id;
  DELETE FROM followers WHERE follower_id = target_user_id OR following_id = target_user_id;
  DELETE FROM marketplace_items WHERE seller_id = target_user_id;
  DELETE FROM referral_codes WHERE user_id = target_user_id;
  DELETE FROM referral_rewards WHERE user_id = target_user_id;
  DELETE FROM user_blocks WHERE blocker_id = target_user_id OR blocked_id = target_user_id;

  DELETE FROM user_stats WHERE user_id = target_user_id;
  DELETE FROM user_challenges WHERE user_id = target_user_id;
  DELETE FROM user_challenge_streaks WHERE user_id = target_user_id;
  DELETE FROM user_interests WHERE user_id = target_user_id;
  DELETE FROM user_skills WHERE user_id = target_user_id;

  DELETE FROM learning_paths WHERE user_id = target_user_id;
  DELETE FROM learning_path_progress WHERE user_id = target_user_id;

  DELETE FROM forecast_comments WHERE user_id = target_user_id;
  DELETE FROM risk_comments WHERE user_id = target_user_id;
  DELETE FROM scenario_comments WHERE user_id = target_user_id;

  DELETE FROM assumption_comment_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_response_mentions WHERE mentioned_user_id = target_user_id;
  DELETE FROM comment_mentions WHERE mentioned_user_id = target_user_id;

  DELETE FROM entity_challenges WHERE user_id = target_user_id;

  DELETE FROM profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;

END;
$$;
