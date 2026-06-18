-- Pattern Intelligence: metadata collection columns
-- These fields accumulate the signal needed to surface patterns at 15+ sessions

-- workspace_conflict_commits: AI-inferred decision category
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_conflict_commits' AND column_name = 'decision_category'
  ) THEN
    ALTER TABLE workspace_conflict_commits
      ADD COLUMN decision_category text
        CHECK (decision_category IN ('strategic','operational','resource','people','technical','market'));
  END IF;
END $$;

-- workspace_synthesis_history: per-session bias flags + risk breakdown snapshots
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_synthesis_history' AND column_name = 'bias_flags_snapshot'
  ) THEN
    ALTER TABLE workspace_synthesis_history
      ADD COLUMN bias_flags_snapshot jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_synthesis_history' AND column_name = 'risk_category_breakdown'
  ) THEN
    ALTER TABLE workspace_synthesis_history
      ADD COLUMN risk_category_breakdown jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_synthesis_history' AND column_name = 'session_decision_category'
  ) THEN
    ALTER TABLE workspace_synthesis_history
      ADD COLUMN session_decision_category text
        CHECK (session_decision_category IN ('strategic','operational','resource','people','technical','market'));
  END IF;
END $$;

-- workspace_action_items: outcome tracking
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_action_items' AND column_name = 'outcome'
  ) THEN
    ALTER TABLE workspace_action_items
      ADD COLUMN outcome text
        CHECK (outcome IN ('pending','succeeded','failed','reversed','abandoned'))
        DEFAULT 'pending';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_action_items' AND column_name = 'outcome_notes'
  ) THEN
    ALTER TABLE workspace_action_items ADD COLUMN outcome_notes text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_action_items' AND column_name = 'outcome_recorded_at'
  ) THEN
    ALTER TABLE workspace_action_items ADD COLUMN outcome_recorded_at timestamptz;
  END IF;
END $$;
