-- Remove per-workspace pattern intelligence columns from workspace_synthesis_history
ALTER TABLE workspace_synthesis_history
  DROP COLUMN IF EXISTS bias_flags_snapshot,
  DROP COLUMN IF EXISTS risk_category_breakdown,
  DROP COLUMN IF EXISTS session_decision_category;

-- Remove pattern intelligence columns from workspace_memory
ALTER TABLE workspace_memory
  DROP COLUMN IF EXISTS dominant_bias,
  DROP COLUMN IF EXISTS recurring_risks,
  DROP COLUMN IF EXISTS decision_category_history;

-- Remove decision_category from workspace_conflict_commits
ALTER TABLE workspace_conflict_commits
  DROP COLUMN IF EXISTS decision_category;
