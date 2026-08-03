
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT email INTO v_email FROM profiles WHERE id = target_user_id;

  -- Workspace data
  DELETE FROM workspace_messages        WHERE user_id = target_user_id;
  DELETE FROM workspace_members         WHERE user_id = target_user_id;
  DELETE FROM workspace_invites         WHERE invited_by = target_user_id
                                           OR (v_email IS NOT NULL AND invited_email = v_email);
  DELETE FROM workspace_action_items    WHERE created_by = target_user_id
                                           OR assignee_user_id = target_user_id;
  DELETE FROM workspace_memory          WHERE user_id = target_user_id;
  DELETE FROM workspace_views           WHERE user_id = target_user_id;
  DELETE FROM workspace_creation_log    WHERE owner_id = target_user_id;
  DELETE FROM workspaces                WHERE owner_id = target_user_id;

  -- Social / content (posts use author_id)
  DELETE FROM post_likes                WHERE user_id = target_user_id;
  DELETE FROM post_comments             WHERE author_id = target_user_id;
  DELETE FROM post_comment_ai_replies   WHERE post_id IN (SELECT id FROM posts WHERE author_id = target_user_id);
  DELETE FROM post_attachments          WHERE post_id IN (SELECT id FROM posts WHERE author_id = target_user_id);
  DELETE FROM posts                     WHERE author_id = target_user_id;
  DELETE FROM reactions                 WHERE user_id = target_user_id;
  DELETE FROM comments                  WHERE author_id = target_user_id;
  DELETE FROM followers                 WHERE follower_id = target_user_id OR following_id = target_user_id;
  DELETE FROM user_blocks               WHERE blocker_id = target_user_id OR blocked_id = target_user_id;

  -- Notifications
  DELETE FROM notifications             WHERE user_id = target_user_id OR actor_id = target_user_id;

  -- Reports / moderation
  DELETE FROM content_reports           WHERE reporter_id = target_user_id OR reported_user_id = target_user_id;
  DELETE FROM moderation_actions        WHERE target_user_id = target_user_id;
  DELETE FROM user_account_status       WHERE user_id = target_user_id;

  -- Referrals / rewards
  DELETE FROM referral_rewards          WHERE user_id = target_user_id;
  DELETE FROM referral_signups          WHERE referrer_id = target_user_id OR referred_id = target_user_id;
  DELETE FROM referral_codes            WHERE user_id = target_user_id;

  -- Stripe
  DELETE FROM stripe_subscriptions      WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = target_user_id
  );
  DELETE FROM stripe_orders             WHERE customer_id IN (
    SELECT id FROM stripe_customers WHERE user_id = target_user_id
  );
  DELETE FROM stripe_customers          WHERE user_id = target_user_id;

  -- Misc user data
  DELETE FROM daily_ai_usage            WHERE user_id = target_user_id;
  DELETE FROM pdf_exports               WHERE user_id = target_user_id;
  DELETE FROM user_challenges           WHERE user_id = target_user_id;
  DELETE FROM user_challenge_streaks    WHERE user_id = target_user_id;
  DELETE FROM user_interests            WHERE user_id = target_user_id;
  DELETE FROM user_skills               WHERE user_id = target_user_id;
  DELETE FROM user_stats                WHERE user_id = target_user_id;
  DELETE FROM user_pattern_intelligence WHERE user_id = target_user_id;
  DELETE FROM posthog_activations       WHERE user_id = target_user_id;
  DELETE FROM forecaster_calibration    WHERE user_id = target_user_id;
  DELETE FROM learning_path_progress    WHERE user_id = target_user_id;
  DELETE FROM upgrade_requests          WHERE user_id = target_user_id;
  DELETE FROM email_accounts            WHERE created_by = target_user_id;

  -- Audit log entry before final deletion
  INSERT INTO admin_audit_log (admin_id, action, target_user_id, details, created_at)
  VALUES (auth.uid(), 'delete_user', target_user_id, '{"method":"delete_user_account"}', now())
  ON CONFLICT DO NOTHING;

  -- Profile (must be last before auth.users)
  DELETE FROM profiles                  WHERE id = target_user_id;

  -- Auth record
  DELETE FROM auth.users                WHERE id = target_user_id;
END;
$$;
