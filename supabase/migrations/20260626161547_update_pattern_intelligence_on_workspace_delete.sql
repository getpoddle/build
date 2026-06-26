-- Trigger: recompute user_pattern_intelligence immediately when a workspace is deleted.
-- This removes the deleted workspace from all pattern data for every member who has
-- pattern intelligence rows, keeping counts and metrics accurate in real time.

CREATE OR REPLACE FUNCTION sync_pattern_intelligence_on_workspace_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_user_id uuid;
  rec RECORD;
  new_snapshots     jsonb;
  new_risk_map      jsonb;
  new_bf            jsonb;
  new_dominant_bias text;
  new_count         integer;
  new_style         text;
  avg_health        numeric;
  high_risk_count   integer;
  low_risk_count    integer;
  snap              jsonb;
  bias_name_val     text;
  bias_cnt          integer;
  max_bias_cnt      integer := 0;
BEGIN
  -- Collect all users who have pattern intelligence referencing this workspace.
  -- This covers the owner and any member who synthesized the workspace.
  FOR rec IN
    SELECT DISTINCT upi.user_id
    FROM user_pattern_intelligence upi
    WHERE upi.workspace_snapshots @> jsonb_build_array(jsonb_build_object('workspace_id', OLD.id::text))
       OR upi.user_id = OLD.owner_id
  LOOP
    affected_user_id := rec.user_id;

    -- Load the current row for this user
    SELECT
      workspace_snapshots,
      risk_tolerance_map,
      bias_fingerprint
    INTO rec
    FROM user_pattern_intelligence
    WHERE user_id = affected_user_id;

    -- If no row exists, nothing to update
    IF NOT FOUND THEN
      CONTINUE;
    END IF;

    -- ── 1. Remove deleted workspace from snapshots ──
    new_snapshots := '[]'::jsonb;
    FOR snap IN SELECT * FROM jsonb_array_elements(COALESCE(rec.workspace_snapshots, '[]'::jsonb))
    LOOP
      IF (snap->>'workspace_id') IS DISTINCT FROM OLD.id::text THEN
        new_snapshots := new_snapshots || jsonb_build_array(snap);
      END IF;
    END LOOP;

    -- ── 2. Remove deleted workspace from risk_tolerance_map ──
    new_risk_map := '[]'::jsonb;
    FOR snap IN SELECT * FROM jsonb_array_elements(COALESCE(rec.risk_tolerance_map, '[]'::jsonb))
    LOOP
      -- risk_tolerance_map uses workspace_name, match by name from OLD
      IF (snap->>'workspace_name') IS DISTINCT FROM OLD.name THEN
        new_risk_map := new_risk_map || jsonb_build_array(snap);
      END IF;
    END LOOP;

    -- ── 3. Recompute workspace_count from remaining snapshots ──
    new_count := jsonb_array_length(new_snapshots);

    -- ── 4. Recompute bias_fingerprint from remaining snapshots ──
    new_bf := '{}'::jsonb;
    FOR snap IN SELECT * FROM jsonb_array_elements(new_snapshots)
    LOOP
      FOR bias_name_val IN SELECT jsonb_array_elements_text(COALESCE(snap->'bias_flags', '[]'::jsonb))
      LOOP
        bias_cnt := COALESCE((new_bf->>bias_name_val)::integer, 0) + 1;
        new_bf := jsonb_set(new_bf, ARRAY[bias_name_val], to_jsonb(bias_cnt));
      END LOOP;
    END LOOP;

    -- ── 5. Recompute dominant_bias ──
    new_dominant_bias := NULL;
    max_bias_cnt := 0;
    FOR bias_name_val, bias_cnt IN
      SELECT key, value::integer
      FROM jsonb_each_text(new_bf)
    LOOP
      IF bias_cnt > max_bias_cnt THEN
        max_bias_cnt := bias_cnt;
        new_dominant_bias := bias_name_val;
      END IF;
    END LOOP;

    -- ── 6. Recompute decision_style_summary ──
    IF new_count = 0 THEN
      new_style := NULL;
    ELSE
      -- Average health score across remaining snapshots
      SELECT AVG((s->>'decision_health_score')::numeric)
      INTO avg_health
      FROM jsonb_array_elements(new_snapshots) AS s
      WHERE (s->>'decision_health_score') IS NOT NULL;

      avg_health := COALESCE(avg_health, 0);

      SELECT COUNT(*)
      INTO high_risk_count
      FROM jsonb_array_elements(new_risk_map) AS r
      WHERE r->>'risk_level' = 'high';

      SELECT COUNT(*)
      INTO low_risk_count
      FROM jsonb_array_elements(new_risk_map) AS r
      WHERE r->>'risk_level' = 'low';

      new_style := CASE
        WHEN avg_health >= 75 AND high_risk_count = 0                    THEN 'Systematic and risk-aware'
        WHEN avg_health >= 65 AND high_risk_count <= 1                   THEN 'Structured and deliberate'
        WHEN avg_health >= 55 AND high_risk_count < new_count / 2        THEN 'Balanced and analytical'
        WHEN avg_health >= 45                                            THEN 'Opportunistic with blind spots'
        WHEN high_risk_count > new_count / 2                             THEN 'High-conviction, high-stakes'
        ELSE                                                              'Developing decision clarity'
      END;
    END IF;

    -- ── 7. Write back ──
    UPDATE user_pattern_intelligence
    SET
      workspace_snapshots    = new_snapshots,
      risk_tolerance_map     = new_risk_map,
      bias_fingerprint       = new_bf,
      dominant_bias          = new_dominant_bias,
      workspace_count        = new_count,
      decision_style_summary = new_style,
      updated_at             = now()
    WHERE user_id = affected_user_id;

  END LOOP;

  RETURN OLD;
END;
$$;

-- Drop and recreate so it's idempotent
DROP TRIGGER IF EXISTS trg_sync_pattern_intelligence_on_workspace_delete ON workspaces;

CREATE TRIGGER trg_sync_pattern_intelligence_on_workspace_delete
  AFTER DELETE ON workspaces
  FOR EACH ROW
  EXECUTE FUNCTION sync_pattern_intelligence_on_workspace_delete();
