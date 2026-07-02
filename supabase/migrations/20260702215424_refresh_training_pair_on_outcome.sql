-- When an action item outcome is recorded (or changed), refresh the
-- outcome counts and quality_score on the corresponding training pair.
-- This keeps the dataset accurate without requiring a full re-synthesis.

CREATE OR REPLACE FUNCTION refresh_training_pair_outcomes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace_id uuid;
  v_succeeded    integer;
  v_failed       integer;
  v_reversed     integer;
  v_abandoned    integer;
  v_total        integer;
  v_success_rate numeric(5,2);
  v_existing     synthesis_training_pairs%ROWTYPE;
  v_quality      integer;
BEGIN
  -- Determine workspace from either NEW or OLD
  v_workspace_id := COALESCE(NEW.workspace_id, OLD.workspace_id);

  -- Recount all done+outcome rows for this workspace
  SELECT
    COUNT(*) FILTER (WHERE outcome = 'succeeded'),
    COUNT(*) FILTER (WHERE outcome = 'failed'),
    COUNT(*) FILTER (WHERE outcome = 'reversed'),
    COUNT(*) FILTER (WHERE outcome = 'abandoned'),
    COUNT(*)
  INTO v_succeeded, v_failed, v_reversed, v_abandoned, v_total
  FROM workspace_action_items
  WHERE workspace_id = v_workspace_id
    AND status = 'done'
    AND outcome IS NOT NULL
    AND outcome != 'pending';

  v_success_rate := CASE WHEN v_total > 0
    THEN ROUND((v_succeeded::numeric / v_total) * 100, 2)
    ELSE NULL END;

  -- Only update if the training pair row already exists (synthesis must run first)
  SELECT * INTO v_existing
  FROM synthesis_training_pairs
  WHERE workspace_id = v_workspace_id;

  IF NOT FOUND THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Recompute quality: base stays from synthesis, outcomes add up to 20 pts
  v_quality := LEAST(100,
    GREATEST(0, v_existing.quality_score - LEAST(20, COALESCE(v_existing.outcomes_recorded, 0) * 4))
    + LEAST(20, v_total * 4)
  );

  UPDATE synthesis_training_pairs SET
    outcomes_recorded  = v_total,
    outcomes_succeeded = v_succeeded,
    outcomes_failed    = v_failed,
    outcomes_reversed  = v_reversed,
    outcomes_abandoned = v_abandoned,
    success_rate       = v_success_rate,
    quality_score      = v_quality,
    last_outcome_at    = now(),
    updated_at         = now()
  WHERE workspace_id = v_workspace_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_refresh_training_pair_outcomes ON workspace_action_items;

CREATE TRIGGER trg_refresh_training_pair_outcomes
  AFTER INSERT OR UPDATE OF outcome ON workspace_action_items
  FOR EACH ROW
  WHEN (NEW.status = 'done' AND NEW.outcome IS NOT NULL AND NEW.outcome != 'pending')
  EXECUTE FUNCTION refresh_training_pair_outcomes();
