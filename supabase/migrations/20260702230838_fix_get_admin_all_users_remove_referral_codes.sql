-- referral_codes was dropped in 20260702131635_drop_legacy_b2c_social_tables.sql
-- but get_admin_all_users still JOINs against it, breaking the admin user list.
-- Remove the referral_code column from the result and drop the broken JOIN.

CREATE OR REPLACE FUNCTION public.get_admin_all_users()
RETURNS TABLE (
  id                    uuid,
  full_name             text,
  email                 text,
  username              text,
  avatar_url            text,
  verified              boolean,
  created_at            timestamptz,
  workspaces_created    bigint,
  workspaces_opened     bigint,
  workspaces_created_alltime bigint,
  pdfs_exported         bigint,
  account_status        text,
  reason                text,
  suspended_until       timestamptz,
  total_reports_against bigint,
  pending_reports_against bigint,
  referral_code         text,
  total_referrals       bigint,
  recent_referrals      bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  BEGIN
    INSERT INTO admin_audit_log(admin_id, action)
    VALUES (auth.uid(), 'get_all_users');
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.username,
    p.avatar_url,
    COALESCE(p.verified, false)                                                                     AS verified,
    p.created_at,
    COALESCE((SELECT COUNT(*) FROM workspaces w        WHERE w.owner_id   = p.id), 0)              AS workspaces_created,
    COALESCE((SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id = p.id), 0)               AS workspaces_opened,
    COALESCE((SELECT COUNT(*) FROM workspace_creation_log wcl WHERE wcl.owner_id = p.id), 0)       AS workspaces_created_alltime,
    COALESCE((SELECT COUNT(*) FROM pdf_exports pe      WHERE pe.user_id   = p.id), 0)              AS pdfs_exported,
    COALESCE(ms.status, 'active')::text                                                            AS account_status,
    ms.reason,
    ms.suspended_until,
    COALESCE(COUNT(DISTINCT cr.id), 0)                                                             AS total_reports_against,
    COALESCE(COUNT(DISTINCT cr.id) FILTER (WHERE cr.status = 'pending'), 0)                       AS pending_reports_against,
    NULL::text                                                                                     AS referral_code,
    COALESCE(COUNT(DISTINCT rs.id), 0)                                                             AS total_referrals,
    COALESCE(COUNT(DISTINCT rs.id) FILTER (WHERE rs.created_at >= date_trunc('month', now())), 0) AS recent_referrals
  FROM profiles p
  LEFT JOIN user_account_status ms ON ms.user_id        = p.id
  LEFT JOIN content_reports     cr ON cr.reported_user_id = p.id
  LEFT JOIN referral_signups    rs ON rs.referrer_id    = p.id
  GROUP BY p.id, p.full_name, p.email, p.username, p.avatar_url, p.verified,
           p.created_at, ms.status, ms.reason, ms.suspended_until
  ORDER BY p.created_at DESC;
END;
$$;
