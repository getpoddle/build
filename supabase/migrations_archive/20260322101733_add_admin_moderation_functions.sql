/*
  # Add Admin Moderation Helper Functions

  1. New Functions
    - `get_user_moderation_info` - Get user's account status and moderation history
    - `get_pending_reports_count` - Get count of pending content reports
    - `suspend_user_account` - Suspend a user account with reason
    - `unsuspend_user_account` - Restore user account to active status
    - `ban_user_account` - Permanently ban a user account

  2. Purpose
    - Provide admins with moderation tools
    - Ensure all actions are logged
    - Simplify user management operations
*/

-- Function to get user moderation info
CREATE OR REPLACE FUNCTION public.get_user_moderation_info(user_id_param uuid)
RETURNS TABLE(
  account_status text,
  reason text,
  suspended_until timestamptz,
  suspended_at timestamptz,
  total_reports_against bigint,
  pending_reports_against bigint,
  total_moderation_actions bigint,
  last_action_date timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(uas.status, 'active')::text,
    uas.reason,
    uas.suspended_until,
    uas.suspended_at,
    (SELECT COUNT(*) FROM content_reports WHERE reported_user_id = user_id_param)::bigint,
    (SELECT COUNT(*) FROM content_reports WHERE reported_user_id = user_id_param AND status = 'pending')::bigint,
    (SELECT COUNT(*) FROM moderation_actions WHERE target_user_id = user_id_param)::bigint,
    (SELECT MAX(created_at) FROM moderation_actions WHERE target_user_id = user_id_param)
  FROM user_account_status uas
  WHERE uas.user_id = user_id_param;
END;
$$;

-- Function to suspend user account
CREATE OR REPLACE FUNCTION public.suspend_user_account(
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
  admin_user_id uuid;
  suspended_until_param timestamptz;
BEGIN
  -- Get the current admin user
  admin_user_id := auth.uid();
  
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_user_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can suspend users';
  END IF;

  -- Calculate suspension end date if duration provided
  IF duration_days IS NOT NULL THEN
    suspended_until_param := now() + (duration_days || ' days')::interval;
  END IF;

  -- Update or insert account status
  INSERT INTO user_account_status (user_id, status, reason, suspended_until, suspended_by, suspended_at, notes)
  VALUES (target_user_id, 'suspended', reason_param, suspended_until_param, admin_user_id, now(), notes_param)
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = 'suspended',
    reason = reason_param,
    suspended_until = suspended_until_param,
    suspended_by = admin_user_id,
    suspended_at = now(),
    notes = notes_param,
    updated_at = now();

  -- Log the action
  INSERT INTO moderation_actions (admin_id, target_user_id, action_type, reason, details)
  VALUES (
    admin_user_id,
    target_user_id,
    'suspend',
    reason_param,
    jsonb_build_object('duration_days', duration_days, 'suspended_until', suspended_until_param, 'notes', notes_param)
  );

  RETURN true;
END;
$$;

-- Function to unsuspend user account
CREATE OR REPLACE FUNCTION public.unsuspend_user_account(
  target_user_id uuid,
  reason_param text DEFAULT 'Suspension lifted'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_user_id uuid;
BEGIN
  -- Get the current admin user
  admin_user_id := auth.uid();
  
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_user_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can unsuspend users';
  END IF;

  -- Update account status to active
  UPDATE user_account_status
  SET
    status = 'active',
    reason = NULL,
    suspended_until = NULL,
    suspended_by = NULL,
    suspended_at = NULL,
    notes = NULL,
    updated_at = now()
  WHERE user_id = target_user_id;

  -- Log the action
  INSERT INTO moderation_actions (admin_id, target_user_id, action_type, reason)
  VALUES (admin_user_id, target_user_id, 'unsuspend', reason_param);

  RETURN true;
END;
$$;

-- Function to ban user account
CREATE OR REPLACE FUNCTION public.ban_user_account(
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
  admin_user_id uuid;
BEGIN
  -- Get the current admin user
  admin_user_id := auth.uid();
  
  -- Check if caller is admin
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = admin_user_id AND is_admin = true) THEN
    RAISE EXCEPTION 'Only admins can ban users';
  END IF;

  -- Update or insert account status
  INSERT INTO user_account_status (user_id, status, reason, suspended_by, suspended_at, notes)
  VALUES (target_user_id, 'banned', reason_param, admin_user_id, now(), notes_param)
  ON CONFLICT (user_id)
  DO UPDATE SET
    status = 'banned',
    reason = reason_param,
    suspended_until = NULL,
    suspended_by = admin_user_id,
    suspended_at = now(),
    notes = notes_param,
    updated_at = now();

  -- Log the action
  INSERT INTO moderation_actions (admin_id, target_user_id, action_type, reason, details)
  VALUES (
    admin_user_id,
    target_user_id,
    'ban',
    reason_param,
    jsonb_build_object('notes', notes_param)
  );

  RETURN true;
END;
$$;

-- Function to get pending reports count
CREATE OR REPLACE FUNCTION public.get_pending_reports_count()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::bigint
  FROM content_reports
  WHERE status = 'pending';
$$;
