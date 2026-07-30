/*
# Fix NULL type cast in consume_war_room_session guard

The early-return for non-existent workspaces used `NULL` for the
`period_end` column (timestamptz), but Postgres inferred it as text.
Cast it explicitly to timestamptz.
*/

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
  SELECT EXISTS(SELECT 1 FROM workspaces w WHERE w.id = p_workspace_id)
  INTO v_ws_exists;

  IF NOT v_ws_exists THEN
    RETURN QUERY
    SELECT false, 0, 0, 0, false, 0, NULL::timestamptz;
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