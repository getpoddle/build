-- Fix: column references in consume_war_room_session and
-- get_workspace_war_room_usage were ambiguous between the RETURNS TABLE
-- output columns (PL/pgSQL variables) and the workspace_war_room_usage
-- table columns of the same name (session_count, overage_count, period_end).
-- Table-qualify all column references so the planner can resolve them.

CREATE OR REPLACE FUNCTION consume_war_room_session(
  p_workspace_id uuid,
  p_plan text
)
RETURNS TABLE(
  allowed boolean,
  session_count integer,
  session_limit integer,
  included integer,
  in_overage boolean,
  overage_count integer,
  period_end timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_cap          integer;
  v_included     integer;
  v_current      integer;
  v_overage      integer;
  v_allowed      boolean := true;
  v_in_overage   boolean := false;
BEGIN
  SELECT w.current_period_start, w.current_period_end
    INTO v_period_start, v_period_end
  FROM workspaces w WHERE w.id = p_workspace_id;

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := date_trunc('month', now()) + interval '1 month';
  END IF;

  v_cap      := 1;
  v_included := 0;
  IF p_plan = 'free' THEN
    v_cap := 1; v_included := 0;
  ELSIF p_plan = 'pro' THEN
    v_cap := 100000; v_included := 15;
  ELSIF p_plan = 'team' THEN
    v_cap := 200; v_included := 200;
  ELSIF p_plan = 'enterprise' THEN
    v_cap := 1000000; v_included := 1000000;
  ELSE
    v_cap := 1; v_included := 0;
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
      UPDATE workspace_war_room_usage u
        SET session_count = v_current, last_session_at = now()
        WHERE u.workspace_id = p_workspace_id AND u.period_start = v_period_start;
    END IF;
  ELSE
    v_current := v_current + 1;
    IF v_current > v_included THEN
      v_in_overage := true;
      v_overage := v_overage + 1;
    END IF;
    UPDATE workspace_war_room_usage u
      SET session_count = v_current,
          overage_count = v_overage,
          last_session_at = now()
      WHERE u.workspace_id = p_workspace_id AND u.period_start = v_period_start;
  END IF;

  RETURN QUERY
    SELECT v_allowed, v_current, v_cap, v_included, v_in_overage, v_overage, v_period_end;
END;
$$;

REVOKE ALL ON FUNCTION consume_war_room_session(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION consume_war_room_session(uuid, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION get_workspace_war_room_usage(p_workspace_id uuid)
RETURNS TABLE(
  session_count integer,
  session_limit integer,
  included integer,
  in_overage boolean,
  overage_count integer,
  period_end timestamptz,
  plan text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_period_start timestamptz;
  v_period_end   timestamptz;
  v_plan         text;
  v_cap          integer := 1;
  v_included     integer := 0;
  v_count        integer := 0;
  v_overage      integer := 0;
BEGIN
  SELECT w.current_period_start, w.current_period_end, w.plan
    INTO v_period_start, v_period_end, v_plan
  FROM workspaces w WHERE w.id = p_workspace_id;

  IF v_period_start IS NULL THEN
    v_period_start := date_trunc('month', now());
    v_period_end   := date_trunc('month', now()) + interval '1 month';
  END IF;

  IF v_plan = 'free' THEN
    v_cap := 1; v_included := 0;
  ELSIF v_plan = 'pro' THEN
    v_cap := 100000; v_included := 15;
  ELSIF v_plan = 'team' THEN
    v_cap := 200; v_included := 200;
  ELSIF v_plan = 'enterprise' THEN
    v_cap := 1000000; v_included := 1000000;
  END IF;

  SELECT u.session_count, u.overage_count
    INTO v_count, v_overage
  FROM workspace_war_room_usage u
  WHERE u.workspace_id = p_workspace_id AND u.period_start = v_period_start;

  v_count   := COALESCE(v_count, 0);
  v_overage := COALESCE(v_overage, 0);

  RETURN QUERY
    SELECT v_count, v_cap, v_included, (v_count > v_included), v_overage, v_period_end, v_plan;
END;
$$;

REVOKE ALL ON FUNCTION get_workspace_war_room_usage(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION get_workspace_war_room_usage(uuid) TO authenticated, service_role;
