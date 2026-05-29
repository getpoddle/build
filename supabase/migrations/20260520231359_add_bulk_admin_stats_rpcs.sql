/*
  # Bulk admin stats RPCs

  ## Problem
  AdminDashboard was calling 3 RPCs per user inside a Promise.all loop,
  producing N×3 sequential database round-trips at scale (N = number of users).

  ## Changes
  Three new SECURITY DEFINER functions that return stats for ALL users in a
  single query each, replacing the per-user variants for the admin list view:

  1. `get_all_users_contribution_stats` — assumptions, challenges, forecasts, risks, scenarios, responses, pods counts per user
  2. `get_all_users_moderation_info`    — account_status, reason, suspended_until, report counts per user
  3. `get_all_users_referral_stats`     — referral_code, total_referrals, recent_referrals per user

  All three are restricted to the admins table via an internal check.
*/

-- 1. Bulk contribution stats
CREATE OR REPLACE FUNCTION get_all_users_contribution_stats()
RETURNS TABLE (
  user_id                  uuid,
  assumptions_count        bigint,
  challenges_count         bigint,
  forecasts_count          bigint,
  risks_count              bigint,
  scenarios_count          bigint,
  challenge_responses_count bigint,
  pods_joined_count        bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only callable by admins
  IF NOT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    COUNT(DISTINCT pa.id)  AS assumptions_count,
    COUNT(DISTINCT ac.id)  AS challenges_count,
    COUNT(DISTINCT af.id)  AS forecasts_count,
    COUNT(DISTINCT ar.id)  AS risks_count,
    COUNT(DISTINCT as2.id) AS scenarios_count,
    COUNT(DISTINCT cr.id)  AS challenge_responses_count,
    COUNT(DISTINCT pm.id)  AS pods_joined_count
  FROM profiles p
  LEFT JOIN pod_assumptions pa     ON pa.created_by = p.id
  LEFT JOIN assumption_challenges ac ON ac.user_id  = p.id
  LEFT JOIN assumption_forecasts af  ON af.user_id  = p.id
  LEFT JOIN assumption_risks ar      ON ar.created_by = p.id
  LEFT JOIN assumption_scenarios as2 ON as2.created_by = p.id
  LEFT JOIN challenge_responses cr   ON cr.user_id  = p.id
  LEFT JOIN pod_members pm           ON pm.user_id  = p.id
  GROUP BY p.id;
END;
$$;

-- 2. Bulk moderation info
CREATE OR REPLACE FUNCTION get_all_users_moderation_info()
RETURNS TABLE (
  user_id                uuid,
  account_status         text,
  reason                 text,
  suspended_until        timestamptz,
  total_reports_against  bigint,
  pending_reports_against bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id AS user_id,
    COALESCE(ms.status, 'active')::text  AS account_status,
    ms.reason,
    ms.suspended_until,
    COUNT(DISTINCT r.id)                                          AS total_reports_against,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'pending')     AS pending_reports_against
  FROM profiles p
  LEFT JOIN user_moderation_status ms ON ms.user_id = p.id
  LEFT JOIN user_reports r            ON r.reported_user_id = p.id
  GROUP BY p.id, ms.status, ms.reason, ms.suspended_until;
END;
$$;

-- 3. Bulk referral stats
CREATE OR REPLACE FUNCTION get_all_users_referral_stats()
RETURNS TABLE (
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
  IF NOT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    p.id                               AS user_id,
    rc.code                            AS referral_code,
    COUNT(DISTINCT ru.id)              AS total_referrals,
    COUNT(DISTINCT ru.id) FILTER (
      WHERE ru.created_at >= date_trunc('month', now())
    )                                  AS recent_referrals
  FROM profiles p
  LEFT JOIN referral_codes rc ON rc.user_id = p.id
  LEFT JOIN referral_uses ru  ON ru.referral_code_id = rc.id
  GROUP BY p.id, rc.code;
END;
$$;
