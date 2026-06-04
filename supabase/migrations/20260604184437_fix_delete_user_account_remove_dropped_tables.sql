/*
  # Fix delete_user_account function

  Rebuilds the function to remove all references to tables that no longer
  exist (challenges, challenge_responses, challenge_votes, challenge_mentions,
  forecast_comments, risk_comments, scenario_comments, entity_challenges)
  and adds cleanup for new tables (workspace_views, pdf_exports, entity_comments).
*/

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

  -- Posts & social
  DELETE FROM post_likes              WHERE user_id   = target_user_id;
  DELETE FROM post_comments           WHERE author_id = target_user_id;
  DELETE FROM comments                WHERE author_id = target_user_id;
  DELETE FROM posts                   WHERE author_id = target_user_id;

  -- Notifications & social graph
  DELETE FROM notifications  WHERE user_id   = target_user_id OR actor_id    = target_user_id;
  DELETE FROM followers      WHERE follower_id = target_user_id OR following_id = target_user_id;
  DELETE FROM user_blocks    WHERE blocker_id = target_user_id OR blocked_id   = target_user_id;

  -- Marketplace & referrals
  DELETE FROM marketplace_items  WHERE seller_id = target_user_id;
  DELETE FROM referral_codes     WHERE user_id   = target_user_id;
  DELETE FROM referral_rewards   WHERE user_id   = target_user_id;

  -- Legacy gamification (tables still exist)
  DELETE FROM user_stats             WHERE user_id = target_user_id;
  DELETE FROM user_challenges        WHERE user_id = target_user_id;
  DELETE FROM user_challenge_streaks WHERE user_id = target_user_id;
  DELETE FROM user_interests         WHERE user_id = target_user_id;
  DELETE FROM user_skills            WHERE user_id = target_user_id;
  DELETE FROM learning_paths         WHERE user_id = target_user_id;
  DELETE FROM learning_path_progress WHERE user_id = target_user_id;

  -- Mentions
  DELETE FROM assumption_comment_mentions  WHERE mentioned_user_id = target_user_id;
  DELETE FROM challenge_response_mentions  WHERE mentioned_user_id = target_user_id;

  -- Entity comments
  DELETE FROM entity_comments WHERE user_id = target_user_id;

  -- Workspace membership & usage tracking
  DELETE FROM workspace_members WHERE user_id = target_user_id;
  DELETE FROM workspace_views   WHERE user_id = target_user_id;
  DELETE FROM pdf_exports       WHERE user_id = target_user_id;

  -- Profile & auth
  DELETE FROM profiles    WHERE id = target_user_id;
  DELETE FROM auth.users  WHERE id = target_user_id;
END;
$$;
