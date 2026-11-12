/*
# Close remaining user-ID and cross-workspace disclosure paths

1. Modified functions
- is_workspace_member: a signed-in caller can ask only about themselves. Other user IDs return false.
- get_my_training_contribution_count: a signed-in caller gets a count only for themselves. Other user IDs return 0.
- get_workspace_war_room_usage: returns no rows unless the signed-in caller is a member of that workspace or an admin.
- get_training_dataset_stats: platform-wide training statistics are returned only to admins (used by the admin dashboard).

2. Security
- No table, policy, or grant changes. Signatures are unchanged.
- Row level security policies and approval functions pass the caller's own ID, so their behavior is unchanged.
- Calls with no signed-in caller (service role, database triggers) are not restricted by the caller checks, except get_training_dataset_stats, which requires an admin session.
*/

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
BEGIN
  IF auth.uid() IS NOT NULL AND p_user_id IS DISTINCT FROM auth.uid() THEN
    RETURN false;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_my_training_contribution_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT COUNT(*)::int FROM synthesis_training_pairs stp
JOIN workspace_members wm ON wm.workspace_id = stp.workspace_id
WHERE wm.user_id = p_user_id AND wm.role = 'owner'
  AND stp.quality_score >= 50 AND stp.outcomes_recorded >= 1
  AND (auth.uid() IS NULL OR auth.uid() = p_user_id);
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_war_room_usage(p_workspace_id uuid)
RETURNS TABLE(session_count integer, session_limit integer, included integer, in_overage boolean, overage_count integer, period_end timestamp with time zone, plan text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_period_start timestamptz;
  v_period_end timestamptz;
  v_ws_plan text;
  v_cap integer := 10;
  v_included integer := 0;
  v_count integer := 0;
  v_overage integer := 0;
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT is_workspace_member(p_workspace_id, auth.uid())
     AND NOT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) THEN
    RETURN;
  END IF;

  SELECT w.current_period_start, w.current_period_end, w.plan INTO v_period_start, v_period_end, v_ws_plan
  FROM workspaces w WHERE w.id = p_workspace_id;
  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end := date_trunc('month', now()) + interval '1 month';
  END IF;
  IF v_ws_plan = 'free' THEN v_cap := 10; v_included := 0;
  ELSIF v_ws_plan = 'pro' THEN v_cap := 100000; v_included := 15;
  ELSIF v_ws_plan = 'team' THEN v_cap := 200; v_included := 200;
  ELSIF v_ws_plan = 'enterprise' THEN v_cap := 1000000; v_included := 1000000;
  END IF;

  SELECT u.session_count, u.overage_count INTO v_count, v_overage
  FROM workspace_war_room_usage u
  WHERE u.workspace_id = p_workspace_id AND u.period_start = v_period_start;
  v_count := COALESCE(v_count, 0);
  v_overage := COALESCE(v_overage, 0);

  RETURN QUERY SELECT v_count, v_cap, v_included, (v_count > v_included), v_overage, v_period_end, v_ws_plan;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_training_dataset_stats()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  RETURN (
    SELECT json_build_object(
      'total_pairs', COUNT(*),
      'high_quality_pairs', COUNT(*) FILTER (WHERE quality_score >= 70),
      'pairs_with_outcomes', COUNT(*) FILTER (WHERE outcomes_recorded >= 3),
      'avg_health_score', ROUND(AVG(decision_health_score)),
      'avg_success_rate', ROUND(AVG(success_rate)),
      'total_outcomes', SUM(outcomes_recorded),
      'category_breakdown', (
        SELECT jsonb_object_agg(decision_category, cnt) FROM (
          SELECT decision_category, COUNT(*)::int AS cnt FROM synthesis_training_pairs GROUP BY decision_category
        ) sub
      )
    ) FROM synthesis_training_pairs
  );
END;
$function$;
