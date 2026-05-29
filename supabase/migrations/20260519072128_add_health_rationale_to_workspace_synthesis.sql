/*
  # Add health_rationale column to workspace_synthesis

  1. Changes
    - `workspace_synthesis` — adds `health_rationale` (text, nullable)
      so the AI-generated rationale for the decision health score is
      persisted to the database and survives page reloads.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_synthesis' AND column_name = 'health_rationale'
  ) THEN
    ALTER TABLE workspace_synthesis ADD COLUMN health_rationale text;
  END IF;
END $$;
