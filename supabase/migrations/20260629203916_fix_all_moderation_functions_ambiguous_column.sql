
-- Fix ambiguous target_user_id in all moderation functions by table-qualifying
-- or using local variables to avoid conflict with the column of the same name.

CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_id uuid := target_user_id;
BEGIN
  SELECT email INTO v_email FROM profiles WHERE id = v_id;

  DELETE FROM workspace_messages        WHERE user_id = v_id;
  DELETE FROM workspace_members         WHERE user_id = v_id;
  DELETE FROM workspace_invites         WHERE invited_by = v_id
                                           OR (v_email IS NOT NULL AND invited_email = v_email);
  DELETE FROM workspace_action_items    WHERE created_by = v_id OR assignee_user_id = v_id;
  DELETE FROM workspace_views           WHERE user_id = v_id;
  DELETE FROM workspace_creation_log    WHERE owner_id = v_id;
  DELETE FROM workspaces                WHERE owner_id = v_id;

  DELETE FROM post_likes                WHERE user_id = v_id;
  DELETE FROM post_comments             WHERE author_id = v_id;
  DELETE FROM post_comment_ai_replies   WHERE post_id IN (SELECT id FROM posts WHERE author_id = v_id);
  DELETE FROM post_attachments          WHERE post_id IN (SELECT id FROM posts WHERE author_id = v_id);
  DELETE FROM posts                     WHERE author_id = v_id;
  DELETE FROM reactions                 WHERE user_id = v_id;
  DELETE FROM comments                  WHERE author_id = v_id;
  DELETE FROM followers                 WHERE follower_id = v_id OR following_id = v_id;
  DELETE FROM user_blocks               WHERE blocker_id = v_id OR blocked_id = v_id;

  DELETE FROM notifications             WHERE user_id = v_id OR actor_id = v_id;

  DELETE FROM content_reports           WHERE reporter_id = v_id OR reported_user_id = v_id;
  DELETE FROM moderation_actions ma     WHERE ma.admin_id = v_id OR ma.target_user_id = v_id;
  DELETE FROM user_account_status       WHERE user_id = v_id;

  DELETE FROM referral_rewards          WHERE user_id = v_id;
  DELETE FROM referral_signups          WHERE referrer_id = v_id OR referred_id = v_id;
  DELETE FROM referral_codes            WHERE user_id = v_id;

  DELETE FROM stripe_subscriptions      WHERE customer_id IN (SELECT id FROM stripe_customers WHERE user_id = v_id);
  DELETE FROM stripe_orders             WHERE customer_id IN (SELECT id FROM stripe_customers WHERE user_id = v_id);
  DELETE FROM stripe_customers          WHERE user_id = v_id;

  DELETE FROM daily_ai_usage            WHERE user_id = v_id;
  DELETE FROM pdf_exports               WHERE user_id = v_id;
  DELETE FROM user_challenges           WHERE user_id = v_id;
  DELETE FROM user_challenge_streaks    WHERE user_id = v_id;
  DELETE FROM user_interests            WHERE user_id = v_id;
  DELETE FROM user_skills               WHERE user_id = v_id;
  DELETE FROM user_stats                WHERE user_id = v_id;
  DELETE FROM user_pattern_intelligence WHERE user_id = v_id;
  DELETE FROM posthog_activations       WHERE user_id = v_id;
  DELETE FROM forecaster_calibration    WHERE user_id = v_id;
  DELETE FROM learning_path_progress    WHERE user_id = v_id;
  DELETE FROM upgrade_requests          WHERE user_id = v_id;
  DELETE FROM email_accounts            WHERE created_by = v_id;

  BEGIN
    INSERT INTO admin_audit_log (admin_id, action, target_user_id, details, created_at)
    VALUES (auth.uid(), 'delete_user', v_id, '{"method":"delete_user_account"}', now());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  DELETE FROM profiles WHERE id = v_id;
END;
$$;

CREATE OR REPLACE FUNCTION ban_user_account(
  target_user_id uuid,
  reason_param text,
  notes_param text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_id uuid := target_user_id;
BEGIN
  v_admin_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can ban users';
  END IF;

  INSERT INTO user_account_status (user_id, status, reason, suspended_by, suspended_at, notes)
  VALUES (v_id, 'banned', reason_param, v_admin_id, now(), notes_param)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'banned',
    reason = reason_param,
    suspended_until = NULL,
    suspended_by = v_admin_id,
    suspended_at = now(),
    notes = notes_param,
    updated_at = now();

  INSERT INTO moderation_actions (admin_id, target_user_id, action_type, reason, details)
  VALUES (v_admin_id, v_id, 'ban', reason_param, jsonb_build_object('notes', notes_param));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION suspend_user_account(
  target_user_id uuid,
  reason_param text,
  duration_days integer DEFAULT NULL,
  notes_param text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_id uuid := target_user_id;
  v_suspended_until timestamptz;
BEGIN
  v_admin_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can suspend users';
  END IF;

  IF duration_days IS NOT NULL THEN
    v_suspended_until := now() + (duration_days || ' days')::interval;
  END IF;

  INSERT INTO user_account_status (user_id, status, reason, suspended_until, suspended_by, suspended_at, notes)
  VALUES (v_id, 'suspended', reason_param, v_suspended_until, v_admin_id, now(), notes_param)
  ON CONFLICT (user_id) DO UPDATE SET
    status = 'suspended',
    reason = reason_param,
    suspended_until = v_suspended_until,
    suspended_by = v_admin_id,
    suspended_at = now(),
    notes = notes_param,
    updated_at = now();

  INSERT INTO moderation_actions (admin_id, target_user_id, action_type, reason, details)
  VALUES (v_admin_id, v_id, 'suspend', reason_param,
    jsonb_build_object('duration_days', duration_days, 'suspended_until', v_suspended_until, 'notes', notes_param));

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION unsuspend_user_account(
  target_user_id uuid,
  reason_param text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin_id uuid;
  v_id uuid := target_user_id;
BEGIN
  v_admin_id := auth.uid();

  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_admin_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can unsuspend users';
  END IF;

  UPDATE user_account_status SET
    status = 'active',
    reason = NULL,
    suspended_until = NULL,
    suspended_by = NULL,
    suspended_at = NULL,
    notes = NULL,
    updated_at = now()
  WHERE user_id = v_id;

  INSERT INTO moderation_actions (admin_id, target_user_id, action_type, reason)
  VALUES (v_admin_id, v_id, 'unsuspend', reason_param);

  RETURN true;
END;
$$;
