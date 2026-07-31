/*
# Fix delete_user_account: remove references to dropped tables

## Problem
The `delete_user_account` SECURITY DEFINER function still contained
`DELETE FROM` statements for 6 tables that were dropped in recent cleanup
migrations (20260702131635 and 20260702133614):
  - post_attachments
  - referral_rewards
  - referral_codes
  - user_challenge_streaks
  - user_stats
  - learning_path_progress

When the function hit the first non-existent table it raised an exception,
which bubbled up through the admin-delete-user edge function as
"Failed to delete user", making user deletion impossible from the admin panel.

## Fix
Recreate the function with only the `DELETE FROM` statements for tables
that still exist. No schema changes, no data loss — just removing dead
references so the function runs cleanly.
*/

CREATE OR REPLACE FUNCTION public.delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  DELETE FROM posts                     WHERE author_id = v_id;
  DELETE FROM reactions                 WHERE user_id = v_id;
  DELETE FROM comments                  WHERE author_id = v_id;
  DELETE FROM followers                 WHERE follower_id = v_id OR following_id = v_id;
  DELETE FROM user_blocks               WHERE blocker_id = v_id OR blocked_id = v_id;

  DELETE FROM notifications             WHERE user_id = v_id OR actor_id = v_id;

  DELETE FROM content_reports           WHERE reporter_id = v_id OR reported_user_id = v_id;
  DELETE FROM moderation_actions ma     WHERE ma.admin_id = v_id OR ma.target_user_id = v_id;
  DELETE FROM user_account_status       WHERE user_id = v_id;

  DELETE FROM referral_signups          WHERE referrer_id = v_id OR referred_id = v_id;

  -- stripe_subscriptions/orders join on the text customer_id (cus_xxx), not the bigint row id
  DELETE FROM stripe_subscriptions      WHERE customer_id IN (SELECT customer_id FROM stripe_customers WHERE user_id = v_id);
  DELETE FROM stripe_orders             WHERE customer_id IN (SELECT customer_id FROM stripe_customers WHERE user_id = v_id);
  DELETE FROM stripe_customers          WHERE user_id = v_id;

  DELETE FROM daily_ai_usage            WHERE user_id = v_id;
  DELETE FROM pdf_exports               WHERE user_id = v_id;
  DELETE FROM user_challenges           WHERE user_id = v_id;
  DELETE FROM user_interests            WHERE user_id = v_id;
  DELETE FROM user_skills               WHERE user_id = v_id;
  DELETE FROM user_pattern_intelligence WHERE user_id = v_id;
  DELETE FROM posthog_activations       WHERE user_id = v_id;
  DELETE FROM forecaster_calibration    WHERE user_id = v_id;
  DELETE FROM upgrade_requests          WHERE user_id = v_id;
  DELETE FROM email_accounts            WHERE created_by = v_id;

  BEGIN
    INSERT INTO admin_audit_log (admin_id, action, target_user_id, details, created_at)
    VALUES (auth.uid(), 'delete_user', v_id, '{"method":"delete_user_account"}', now());
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  DELETE FROM profiles WHERE id = v_id;
END;
$function$;
