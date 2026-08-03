-- H4 + H5: Admin audit log table + hardened admin functions

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_id   uuid,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read the audit log; no one can insert/update/delete via RLS
-- (inserts happen only via SECURITY DEFINER functions)
CREATE POLICY "admins_read_audit_log" ON admin_audit_log
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created_at ON admin_audit_log(created_at DESC);

-- H4: Rewrite delete_user_account with explicit transaction + audit record
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  caller_id uuid := auth.uid();
BEGIN
  -- Verify caller is an admin
  IF NOT EXISTS (SELECT 1 FROM admins WHERE id = caller_id) THEN
    RAISE EXCEPTION 'Only admins can delete user accounts';
  END IF;

  -- Audit record written before deletions so it survives even if caller rolls back
  INSERT INTO admin_audit_log(admin_id, action, target_id, metadata)
  VALUES (caller_id, 'delete_user', target_user_id,
          jsonb_build_object('target_user_id', target_user_id));

  -- All deletions in one atomic block; any failure rolls everything back
  DELETE FROM pod_assumptions         WHERE created_by       = target_user_id;
  DELETE FROM assumption_forecasts    WHERE created_by       = target_user_id;
  DELETE FROM assumption_risks        WHERE created_by       = target_user_id;
  DELETE FROM assumption_scenarios    WHERE created_by       = target_user_id;
  DELETE FROM challenges              WHERE created_by       = target_user_id;
  DELETE FROM challenge_responses     WHERE created_by       = target_user_id;
  DELETE FROM decision_thread_responses WHERE created_by    = target_user_id;
  DELETE FROM decision_threads        WHERE created_by       = target_user_id;
  DELETE FROM posts                   WHERE created_by       = target_user_id;
  DELETE FROM comments                WHERE created_by       = target_user_id;
  DELETE FROM notifications           WHERE user_id          = target_user_id
                                         OR actor_id         = target_user_id;
  DELETE FROM likes                   WHERE user_id          = target_user_id;
  DELETE FROM followers               WHERE follower_id      = target_user_id
                                         OR following_id     = target_user_id;
  DELETE FROM pod_members             WHERE user_id          = target_user_id;
  DELETE FROM marketplace_listings    WHERE seller_id        = target_user_id;
  DELETE FROM invite_codes            WHERE created_by       = target_user_id
                                         OR used_by          = target_user_id;
  DELETE FROM user_blocks             WHERE blocker_id       = target_user_id
                                         OR blocked_id       = target_user_id;
  DELETE FROM account_status          WHERE user_id          = target_user_id;
  DELETE FROM moderation_actions      WHERE target_user_id   = target_user_id
                                         OR moderator_id     = target_user_id;

  -- Profile (cascades to FK children with ON DELETE CASCADE)
  DELETE FROM profiles WHERE id = target_user_id;

  -- Auth record
  DELETE FROM auth.users WHERE id = target_user_id;

EXCEPTION WHEN OTHERS THEN
  RAISE; -- propagates the error; Postgres automatically rolls back the transaction
END;
$$;

GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;

-- H5: Add audit logging to get_admin_all_users
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

  INSERT INTO admin_audit_log(admin_id, action)
  VALUES (auth.uid(), 'get_all_users');

  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.username,
    p.avatar_url,
    COALESCE(p.verified, false)                                                                    AS verified,
    p.created_at,
    COALESCE((SELECT COUNT(*) FROM workspaces w WHERE w.owner_id = p.id), 0)                      AS workspaces_created,
    COALESCE((SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id = p.id), 0)              AS workspaces_opened,
    COALESCE((SELECT COUNT(*) FROM workspace_creation_log wcl WHERE wcl.owner_id = p.id), 0)      AS workspaces_created_alltime,
    COALESCE((SELECT COUNT(*) FROM pdf_exports pe WHERE pe.user_id = p.id), 0)                    AS pdfs_exported,
    COALESCE(ms.status, 'active')::text                                                           AS account_status,
    ms.reason,
    ms.suspended_until,
    COALESCE(COUNT(DISTINCT r.id), 0)                                                             AS total_reports_against,
    COALESCE(COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pending'), 0)                        AS pending_reports_against,
    rc.code                                                                                       AS referral_code,
    COALESCE(COUNT(DISTINCT ru.id), 0)                                                            AS total_referrals,
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
