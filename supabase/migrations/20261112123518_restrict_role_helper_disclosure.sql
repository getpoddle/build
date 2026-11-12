/*
# Restrict role and membership lookups to the caller and co-members

1. Modified functions
- get_workspace_role and get_organization_role: a signed-in caller can read another user's role only when the caller shares that workspace or organization. Otherwise the result is NULL.
- can_verify_evidence, is_decision_owner, is_evidence_reviewer, is_workspace_admin_or_owner: a signed-in caller can ask only about themselves. Any other user ID returns false.
- get_decision_benchmark_stats: returns NULL until at least 5 contributions exist in the category, so one contributor's score cannot be read back.

2. Security
- No table, policy, or grant changes. Grants are kept so existing callers still reach the functions.
- Row level security policies and the approval, evidence, and snapshot functions always pass the caller's own ID, so their behavior is unchanged.
- Calls with no signed-in caller (service role, database triggers) are not restricted by the new checks.
*/

CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $function$
DECLARE
  v_caller uuid := auth.uid();
  v_role text;
BEGIN
  IF v_caller IS NOT NULL AND p_user_id IS DISTINCT FROM v_caller
     AND NOT EXISTS (
       SELECT 1 FROM workspace_members
       WHERE workspace_id = p_workspace_id AND user_id = v_caller
     ) THEN
    RETURN NULL;
  END IF;

  SELECT role INTO v_role FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  RETURN v_role;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_organization_role(org_id uuid, uid uuid)
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT om.role FROM organization_members om
  WHERE om.organization_id = org_id AND om.user_id = uid
    AND (
      auth.uid() IS NULL
      OR uid = auth.uid()
      OR EXISTS (
        SELECT 1 FROM organization_members c
        WHERE c.organization_id = org_id AND c.user_id = auth.uid()
      )
    )
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(p_workspace_id uuid, p_user_id uuid)
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
    WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
    AND role IN ('admin', 'owner')
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_decision_owner(p_workspace_id uuid, p_user_id uuid)
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
    SELECT 1 FROM domain_owners
    WHERE workspace_id = p_workspace_id
    AND (owner_user_id = p_user_id OR backup_owner_user_id = p_user_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.is_evidence_reviewer(p_workspace_id uuid, p_user_id uuid)
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
    SELECT 1 FROM evidence_reviewers
    WHERE workspace_id = p_workspace_id
    AND user_id = p_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_verify_evidence(p_workspace_id uuid, p_user_id uuid)
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
  RETURN (
    is_workspace_admin_or_owner(p_workspace_id, p_user_id)
    OR is_decision_owner(p_workspace_id, p_user_id)
    OR is_evidence_reviewer(p_workspace_id, p_user_id)
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_decision_benchmark_stats(p_category text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT CASE WHEN COUNT(*) < 5 THEN NULL::json ELSE json_build_object(
  'count',      COUNT(*)::int,
  'avg_score',  ROUND(AVG(health_score))::int,
  'p25_score',  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY health_score)::int,
  'p75_score',  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY health_score)::int,
  'p90_score',  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY health_score)::int
) END
FROM decision_benchmarks
WHERE category = p_category
AND contributed_at > now() - interval '90 days';
$function$;
