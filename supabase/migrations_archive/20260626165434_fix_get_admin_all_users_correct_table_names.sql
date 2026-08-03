
-- Recreate the unified admin users RPC with the correct table names.
-- Correct tables: user_account_status (not user_moderation_status),
--                 content_reports (not user_reports),
--                 referral_signups (not referral_uses).
CREATE OR REPLACE FUNCTION get_admin_all_users()
RETURNS TABLE(
  id                         uuid,
  full_name                  text,
  email                      text,
  username                   text,
  avatar_url                 text,
  verified                   boolean,
  created_at                 timestamptz,
  workspaces_created         bigint,
  workspaces_opened          bigint,
  workspaces_created_alltime bigint,
  pdfs_exported              bigint,
  account_status             text,
  reason                     text,
  suspended_until            timestamptz,
  total_reports_against      bigint,
  pending_reports_against    bigint,
  referral_code              text,
  total_referrals            bigint,
  recent_referrals           bigint
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
    p.id,
    p.full_name,
    p.email,
    p.username,
    p.avatar_url,
    COALESCE(p.verified, false),
    p.created_at,
    -- workspace stats (live)
    COALESCE((SELECT COUNT(*) FROM workspaces w         WHERE w.owner_id    = p.id), 0),
    COALESCE((SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id    = p.id), 0),
    COALESCE((SELECT COUNT(*) FROM workspace_creation_log wcl WHERE wcl.owner_id = p.id), 0),
    COALESCE((SELECT COUNT(*) FROM pdf_exports pe       WHERE pe.user_id    = p.id), 0),
    -- moderation (user_account_status is the correct table)
    COALESCE(uas.status, 'active')::text,
    uas.reason,
    uas.suspended_until,
    COALESCE(COUNT(DISTINCT cr.id), 0),
    COALESCE(COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'pending'), 0),
    -- referrals (referral_signups is the correct join table)
    rc.code,
    COALESCE(COUNT(DISTINCT rs.id), 0),
    COALESCE(COUNT(DISTINCT rs.id) FILTER (WHERE rs.created_at >= date_trunc('month', now())), 0)
  FROM profiles p
  LEFT JOIN user_account_status uas ON uas.user_id = p.id
  LEFT JOIN content_reports     cr  ON cr.reported_user_id = p.id
  LEFT JOIN referral_codes      rc  ON rc.user_id = p.id
  LEFT JOIN referral_signups    rs  ON rs.referrer_id = p.id
  GROUP BY
    p.id, p.full_name, p.email, p.username, p.avatar_url, p.verified, p.created_at,
    uas.status, uas.reason, uas.suspended_until, rc.code
  ORDER BY p.created_at DESC;
END;
$$;
