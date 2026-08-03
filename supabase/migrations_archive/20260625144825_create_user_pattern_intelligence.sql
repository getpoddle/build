-- Cross-workspace pattern intelligence: one row per user, updated on every synthesis run
CREATE TABLE user_pattern_intelligence (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,

  -- How many of the user's workspaces have been synthesized at least once
  workspace_count integer NOT NULL DEFAULT 0,

  -- Ordered list of workspace names/topics that have been analyzed
  workspace_snapshots jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- Each element: { workspace_id, workspace_name, decision_health_score, dominant_risk_category, bias_flags }

  -- Bias fingerprint: map of bias_name -> count across all workspaces
  bias_fingerprint jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- The single most frequently flagged bias across all workspaces
  dominant_bias text,

  -- Risk tolerance per workspace: [{ workspace_name, health_score, risk_level }]
  risk_tolerance_map jsonb NOT NULL DEFAULT '[]'::jsonb,

  -- Decision categories across workspaces in order: ["operational","market","people",...]
  decision_category_history text[] NOT NULL DEFAULT '{}',

  -- Deterministic one-line decision style label
  decision_style_summary text,

  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE user_pattern_intelligence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own pattern intelligence"
  ON user_pattern_intelligence FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own pattern intelligence"
  ON user_pattern_intelligence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pattern intelligence"
  ON user_pattern_intelligence FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own pattern intelligence"
  ON user_pattern_intelligence FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
