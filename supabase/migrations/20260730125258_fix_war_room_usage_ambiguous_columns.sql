/*
# Fix ambiguous column references in War Room usage functions

## Problem
Both `get_workspace_war_room_usage` and `consume_war_room_session` have
PL/pgSQL variables named `plan` / `v_plan` that shadow the `workspaces.plan`
column. When the function body does `SELECT ... plan FROM workspaces`,
Postgres raises an "ambiguous column reference" error because it can't
tell whether `plan` refers to the output variable or the table column.

`consume_war_room_session` was previously patched (its variable is `v_plan`),
but `get_workspace_war_room_usage` still uses a bare `plan` variable name
and crashes on every call. This causes the `workspace-usage` edge function
to return a 500, and any frontend code relying on it sees broken usage data.

Additionally, `consume_war_room_session` crashes with a foreign-key violation
when called with a workspace_id that doesn't exist in the `workspaces` table
(e.g. a stale/cached ID from a deleted workspace). The INSERT into
`workspace_war_room_usage` fails because of the FK constraint. This should
be handled gracefully instead of crashing.

## Changes
1. **`get_workspace_war_room_usage`**: Rename the `plan` output column alias
   and the local variable to avoid shadowing. Qualify all column references
   with `w.` prefix.
2. **`consume_war_room_session`**: Add a guard at the top — if the workspace
   doesn't exist, return `allowed = false` with `session_limit = 0` so the
   caller gets a clear "limit reached" response instead of a 500 crash.
   Also qualify all column references with `w.` prefix for safety.

## Security
No RLS or policy changes. Both functions are `SECURITY DEFINER` with
`search_path = public`, unchanged.
*/

-- ── 1. Fix get_workspace_war_room_usage ──
CREATE OR REPLACE FUNCTION public.get_workspace_war_room_usage(p_workspace_id uuid)
RETURNS TABLE(
  session_count integer,
  session_limit integer,
  included integer,
  in_overage boolean,
  overage_count integer,
  period_end timestamp with time zone,
  plan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_ws_plan      text;
  v_cap          integer := 10;
  v_included     integer := 0;
  v_count        integer := 0;
  v_overage      integer := 0;
BEGIN
  SELECT w.current_period_start, w.current_period_end, w.plan
  INTO v_period_start, v_period_end, v_ws_plan
  FROM workspaces w WHERE w.id = p_workspace_id;

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := date_trunc('month', now()) + interval '1 month';
  END IF;

  IF v_ws_plan = 'free' THEN
    v_cap := 10; v_included := 0;
  ELSIF v_ws_plan = 'pro' THEN
    v_cap := 100000; v_included := 15;
  ELSIF v_ws_plan = 'team' THEN
    v_cap := 200; v_included := 200;
  ELSIF v_ws_plan = 'enterprise' THEN
    v_cap := 1000000; v_included := 1000000;
  END IF;

  SELECT u.session_count, u.overage_count
  INTO v_count, v_overage
  FROM workspace_war_room_usage u
  WHERE u.workspace_id = p_workspace_id AND u.period_start = v_period_start;

  v_count   := COALESCE(v_count, 0);
  v_overage := COALESCE(v_overage, 0);

  RETURN QUERY
  SELECT v_count, v_cap, v_included, (v_count > v_included), v_overage, v_period_end, v_ws_plan;
END;
$function$;

-- ── 2. Fix consume_war_room_session — guard against missing workspace ──
CREATE OR REPLACE FUNCTION public.consume_war_room_session(p_workspace_id uuid, p_plan text)
RETURNS TABLE(
  allowed boolean,
  session_count integer,
  session_limit integer,
  included integer,
  in_overage boolean,
  overage_count integer,
  period_end timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_cap          integer;
  v_included     integer;
  v_current      integer;
  v_overage      integer;
  v_allowed      boolean := true;
  v_in_overage   boolean := false;
  v_ws_exists    boolean;
BEGIN
  -- Guard: if the workspace doesn't exist, return not-allowed instead of
  -- crashing on the FK-constrained INSERT below.
  SELECT EXISTS(SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id)
  INTO v_ws_exists;

  IF NOT v_ws_exists THEN
    RETURN QUERY
    SELECT false, 0, 0, 0, false, 0, NULL;
    RETURN;
  END IF;

  SELECT w.current_period_start, w.current_period_end
  INTO v_period_start, v_period_end
  FROM workspaces w WHERE w.id = p_workspace_id;

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := date_trunc('month', now()) + interval '1 month';
  END IF;

  v_cap      := 10;
  v_included := 0;
  IF p_plan = 'free' THEN
    v_cap := 10; v_included := 0;
  ELSIF p_plan = 'pro' THEN
    v_cap := 100000; v_included := 15;
  ELSIF p_plan = 'team' THEN
    v_cap := 200; v_included := 200;
  ELSIF p_plan = 'enterprise' THEN
    v_cap := 1000000; v_included := 1000000;
  ELSE
    v_cap := 10; v_included := 0;
  END IF;

  INSERT INTO workspace_war_room_usage (workspace_id, period_start, period_end, session_count, overage_count)
  VALUES (p_workspace_id, v_period_start, v_period_end, 0, 0)
  ON CONFLICT (workspace_id, period_start) DO NOTHING;

  SELECT u.session_count, u.overage_count
  INTO v_current, v_overage
  FROM workspace_war_room_usage u
  WHERE u.workspace_id = p_workspace_id AND u.period_start = v_period_start
  FOR UPDATE;

  IF p_plan = 'free' THEN
    IF v_current >= v_cap THEN
      v_allowed := false;
    ELSE
      v_current := v_current + 1;
      UPDATE workspace_war_room_usage
      SET session_count = v_current, last_session_at = now()
      WHERE workspace_id = p_workspace_id AND period_start = v_period_start;
    END IF;
  ELSE
    v_current := v_current + 1;
    IF v_current > v_included THEN
      v_in_overage := true;
      v_overage := v_overage + 1;
    END IF;
    UPDATE workspace_war_room_usage
    SET session_count = v_current,
        overage_count = v_overage,
        last_session_at = now()
    WHERE workspace_id = p_workspace_id AND period_start = v_period_start;
  END IF;

  RETURN QUERY
  SELECT v_allowed, v_current, v_cap, v_included, v_in_overage, v_overage, v_period_end;
END;
$function$;