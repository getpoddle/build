
-- Fix the stale admin RPCs that referenced non-existent tables.
-- These are no longer called by the admin panel (replaced by get_admin_all_users),
-- but fixing them prevents silent errors if ever invoked directly.

CREATE OR REPLACE FUNCTION get_all_users_moderation_info()
RETURNS TABLE(
  user_id                 uuid,
  account_status          text,
  reason                  text,
  suspended_until         timestamptz,
  total_reports_against   bigint,
  pending_reports_against bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id                                                                          AS user_id,
    COALESCE(uas.status, 'active')::text                                          AS account_status,
    uas.reason,
    uas.suspended_until,
    COALESCE(COUNT(DISTINCT cr.id), 0)                                            AS total_reports_against,
    COALESCE(COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'pending'), 0)       AS pending_reports_against
  FROM profiles p
  LEFT JOIN user_account_status uas ON uas.user_id = p.id
  LEFT JOIN content_reports     cr  ON cr.reported_user_id = p.id
  GROUP BY p.id, uas.status, uas.reason, uas.suspended_until;
END;
$$;

CREATE OR REPLACE FUNCTION get_all_users_referral_stats()
RETURNS TABLE(
  user_id         uuid,
  referral_code   text,
  total_referrals bigint,
  recent_referrals bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id                                                                                     AS user_id,
    rc.code                                                                                  AS referral_code,
    COALESCE(COUNT(DISTINCT rs.id), 0)                                                       AS total_referrals,
    COALESCE(COUNT(DISTINCT rs.id) FILTER (WHERE rs.created_at >= date_trunc('month', now())), 0) AS recent_referrals
  FROM profiles p
  LEFT JOIN referral_codes   rc ON rc.user_id   = p.id
  LEFT JOIN referral_signups rs ON rs.referrer_id = p.id
  GROUP BY p.id, rc.code;
END;
$$;
