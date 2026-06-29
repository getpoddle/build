
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_target_id uuid := target_user_id;
BEGIN
  SELECT email INTO v_email FROM profiles WHERE id = v_target_id;

  -- Workspace data
  DELETE FROM workspace_messages        WHERE user_id = v_target_id;
  DELETE FROM workspace_members         WHERE user_id = v_target_id;
  DELETE FROM workspace_invites         WHERE invited_by = v_target_id
                                           OR (v_email IS NOT NULL AND invited_email = v_email);
  DELETE FROM workspace_action_items    WHERE created_by = v_target_id
                                           OR assignee_user_id = v_target_id;
  -- workspace_memory is keyed by workspace_id; cleaned up via workspaces cascade
  DELETE FROM workspace_views           WHERE user_id = v_target_id;
  DELETE FROM workspace_creation_log    WHERE owner_id = v_target_id;
  DELETE FROM workspaces                WHERE owner_id = v_target_id;

  -- Social / content
  DELETE FROM post_likes                WHERE user_id = v_target_id;
  DELETE FROM post_comments             WHERE author_id = v_target_id;
  DELETE FROM post_comment_ai_replies   WHERE post_id IN (SELECT id FROM posts WHERE author_id = v_target_id);
  DELETE FROM post_attachments          WHERE post_id IN (SELECT id FROM posts WHERE author_id = v_target_id);
  DELETE FROM posts                     WHERE author_id = v_target_id;
  DELETE FROM reactions                 WHERE user_id = v_target_id;
  DELETE FROM comments                  WHERE author_id = v_target_id;
  DELETE FROM followers                 WHERE follower_id = v_target_id OR following_id = v_target_id;
  DELETE FROM user_blocks               WHERE blocker_id = v_target_id OR blocked_id = v_target_id;

  -- Notifications
  DELETE FROM notifications             WHERE user_id = v_target_id OR actor_id = v_target_id;

  -- Reports / moderation
  DELETE FROM content_reports           WHERE reporter_id = v_target_id OR reported_user_id = v_target_id;
  DELETE FROM moderation_actions        WHERE admin_id = v_target_id OR target_user_id = v_target_id;
  DELETE FROM user_account_status       WHERE user_id = v_target_id;

  -- Referrals / rewards
  DELETE FROM referral_rewards          WHERE user_id = v_target_id;
  DELETE FROM referral_signups          WHERE referrer_id = v_target_id OR referred_id = v_target_id;
  DELETE FROM referral_codes            WHERE user_id = v_target_id;

  -- Stripe
  DELETE FROM stripe_subscriptions      WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = v_target_id
  );
  DELETE FROM stripe_orders             WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = v_target_id
  );
  DELETE FROM stripe_customers          WHERE user_id = v_target_id;

  -- Misc user data
  DELETE FROM daily_ai_usage            WHERE user_id = v_target_id;
  DELETE FROM pdf_exports               WHERE user_id = v_target_id;
  DELETE FROM user_challenges           WHERE user_id = v_target_id;
  DELETE FROM user_challenge_streaks    WHERE user_id = v_target_id;
  DELETE FROM user_interests            WHERE user_id = v_target_id;
  DELETE FROM user_skills               WHERE user_id = v_target_id;
  DELETE FROM user_stats                WHERE user_id = v_target_id;
  DELETE FROM user_pattern_intelligence WHERE user_id = v_target_id;
  DELETE FROM posthog_activations       WHERE user_id = v_target_id;
  DELETE FROM forecaster_calibration    WHERE user_id = v_target_id;
  DELETE FROM learning_path_progress    WHERE user_id = v_target_id;
  DELETE FROM upgrade_requests          WHERE user_id = v_target_id;
  DELETE FROM email_accounts            WHERE created_by = v_target_id;

  -- Audit log
  BEGIN
    INSERT INTO admin_audit_log (admin_id, action, target_user_id, details, created_at)
    VALUES (auth.uid(), 'delete_user', v_target_id, '{"method":"delete_user_account"}', now());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- Profile (auth.users deletion handled by the edge function)
  DELETE FROM profiles WHERE id = v_target_id;
END;
$$;
