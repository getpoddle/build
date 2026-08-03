-- Pattern intelligence fields on workspace_memory
-- Written by workspace-synthesize after each synthesis run, read by workspace-ai-chat

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_memory' AND column_name = 'recurring_risks'
  ) THEN
    ALTER TABLE workspace_memory ADD COLUMN recurring_risks text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_memory' AND column_name = 'dominant_bias'
  ) THEN
    ALTER TABLE workspace_memory ADD COLUMN dominant_bias text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_memory' AND column_name = 'decision_category_history'
  ) THEN
    ALTER TABLE workspace_memory ADD COLUMN decision_category_history text[] NOT NULL DEFAULT '{}';
  END IF;
END $$;
