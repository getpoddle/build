
-- Single SECURITY DEFINER RPC that returns all user data needed by the admin panel.
-- Runs as the function owner (bypasses RLS), so it always sees every profile
-- regardless of the caller's session state.
-- Auth guard: caller must be in the admins table.
CREATE OR REPLACE FUNCTION get_admin_all_users()
RETURNS TABLE(
  id                       uuid,
  full_name                text,
  email                    text,
  username                 text,
  avatar_url               text,
  verified                 boolean,
  created_at               timestamptz,
  -- workspace stats
  workspaces_created       bigint,
  workspaces_opened        bigint,
  workspaces_created_alltime bigint,
  pdfs_exported            bigint,
  -- moderation
  account_status           text,
  reason                   text,
  suspended_until          timestamptz,
  total_reports_against    bigint,
  pending_reports_against  bigint,
  -- referrals
  referral_code            text,
  total_referrals          bigint,
  recent_referrals         bigint
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
    COALESCE(p.verified, false)                                          AS verified,
    p.created_at,
    -- workspace stats (live)
    COALESCE((SELECT COUNT(*) FROM workspaces w WHERE w.owner_id = p.id), 0)           AS workspaces_created,
    COALESCE((SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id = p.id), 0)   AS workspaces_opened,
    COALESCE((SELECT COUNT(*) FROM workspace_creation_log wcl WHERE wcl.owner_id = p.id), 0) AS workspaces_created_alltime,
    COALESCE((SELECT COUNT(*) FROM pdf_exports pe WHERE pe.user_id = p.id), 0)         AS pdfs_exported,
    -- moderation
    COALESCE(ms.status, 'active')::text                                  AS account_status,
    ms.reason,
    ms.suspended_until,
    COALESCE(COUNT(DISTINCT r.id), 0)                                    AS total_reports_against,
    COALESCE(COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pending'), 0) AS pending_reports_against,
    -- referrals
    rc.code                                                              AS referral_code,
    COALESCE(COUNT(DISTINCT ru.id), 0)                                   AS total_referrals,
    COALESCE(COUNT(DISTINCT ru.id) FILTER (WHERE ru.created_at >= date_trunc('month', now())), 0) AS recent_referrals
  FROM profiles p
  LEFT JOIN user_moderation_status ms ON ms.user_id = p.id
  LEFT JOIN user_reports r ON r.reported_user_id = p.id
  LEFT JOIN referral_codes rc ON rc.user_id = p.id
  LEFT JOIN referral_uses ru ON ru.referral_code_id = rc.id
  GROUP BY p.id, p.full_name, p.email, p.username, p.avatar_url, p.verified,
           p.created_at, ms.status, ms.reason, ms.suspended_until, rc.code
  ORDER BY p.created_at DESC;
END;
$$;
