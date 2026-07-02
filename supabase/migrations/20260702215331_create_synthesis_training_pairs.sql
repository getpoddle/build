-- Direction 4: Proprietary model fine-tuning dataset
--
-- Each row is one complete (decision → synthesis → outcomes) training example.
-- Populated automatically when:
--   a) A synthesis completes on a workspace that has opted into benchmarks, OR
--   b) An action item outcome is recorded (the pair is enriched/refreshed)
--
-- The "input" is the decision context (topic + transcript summary).
-- The "output" is the synthesis quality + what actions succeeded/failed.
-- Together they form labelled examples: "for this kind of decision, these
-- risks materialised, and X% of recommended actions worked."

CREATE TABLE IF NOT EXISTS synthesis_training_pairs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Workspace reference (retained so the row can be refreshed when outcomes
  -- are added; never exposed outside admin context)
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Anonymised decision context: topic label + dominant risk category.
  -- We deliberately do NOT store workspace name or description verbatim
  -- to protect confidentiality.
  decision_category text NOT NULL,          -- e.g. 'market', 'execution'
  decision_health_score integer,
  decision_style text,                      -- e.g. 'Systematic and risk-aware'

  -- Synthesis quality signals (counts only — no PII)
  risk_signal_count integer DEFAULT 0,
  blind_spot_count integer DEFAULT 0,
  consensus_point_count integer DEFAULT 0,
  conflict_zone_count integer DEFAULT 0,
  open_question_count integer DEFAULT 0,
  action_item_count integer DEFAULT 0,
  cognitive_bias_count integer DEFAULT 0,

  -- Dominant bias name (descriptive, not tied to a user identity)
  dominant_bias text,

  -- Real-world outcome signals (populated as outcomes are recorded)
  outcomes_recorded integer DEFAULT 0,
  outcomes_succeeded integer DEFAULT 0,
  outcomes_failed integer DEFAULT 0,
  outcomes_reversed integer DEFAULT 0,
  outcomes_abandoned integer DEFAULT 0,
  success_rate numeric(5,2),                -- succeeded / total outcomes

  -- Training quality score: higher = more useful for fine-tuning
  -- Computed from synthesis depth + number of outcomes recorded
  quality_score integer DEFAULT 0,

  -- Timestamps
  synthesis_at timestamptz NOT NULL DEFAULT now(),
  last_outcome_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  UNIQUE (workspace_id)  -- one row per workspace, refreshed on re-synthesis
);

CREATE INDEX IF NOT EXISTS idx_training_pairs_category ON synthesis_training_pairs(decision_category);
CREATE INDEX IF NOT EXISTS idx_training_pairs_quality ON synthesis_training_pairs(quality_score DESC);
CREATE INDEX IF NOT EXISTS idx_training_pairs_health ON synthesis_training_pairs(decision_health_score);
CREATE INDEX IF NOT EXISTS idx_training_pairs_outcomes ON synthesis_training_pairs(outcomes_recorded DESC);

ALTER TABLE synthesis_training_pairs ENABLE ROW LEVEL SECURITY;

-- Only admins / service role can read — users never directly query this table
CREATE POLICY "service_role_all_training_pairs"
  ON synthesis_training_pairs FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- No authenticated client access (data accessed only through admin RPCs)
CREATE POLICY "no_client_select_training_pairs"
  ON synthesis_training_pairs FOR SELECT
  TO authenticated
  USING (false);

-- ─── RPC: training dataset stats for admin dashboard ───────────────────────
CREATE OR REPLACE FUNCTION get_training_dataset_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'total_pairs',          COUNT(*),
    'high_quality_pairs',   COUNT(*) FILTER (WHERE quality_score >= 70),
    'pairs_with_outcomes',  COUNT(*) FILTER (WHERE outcomes_recorded >= 3),
    'avg_health_score',     ROUND(AVG(decision_health_score)),
    'avg_success_rate',     ROUND(AVG(success_rate)),
    'total_outcomes',       SUM(outcomes_recorded),
    'category_breakdown',   (
      SELECT jsonb_object_agg(decision_category, cnt)
      FROM (
        SELECT decision_category, COUNT(*)::int AS cnt
        FROM synthesis_training_pairs
        GROUP BY decision_category
      ) sub
    )
  )
  FROM synthesis_training_pairs;
$$;

GRANT EXECUTE ON FUNCTION get_training_dataset_stats() TO authenticated;

-- ─── RPC: user's contribution count (for "Contributing to model" badge) ────
-- Returns the number of training pairs this user has contributed
-- (workspaces they own that have quality_score >= 50 with at least 1 outcome).
CREATE OR REPLACE FUNCTION get_my_training_contribution_count(p_user_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM synthesis_training_pairs stp
  JOIN workspace_members wm ON wm.workspace_id = stp.workspace_id
  WHERE wm.user_id = p_user_id
    AND wm.role = 'owner'
    AND stp.quality_score >= 50
    AND stp.outcomes_recorded >= 1;
$$;

GRANT EXECUTE ON FUNCTION get_my_training_contribution_count(uuid) TO authenticated;
