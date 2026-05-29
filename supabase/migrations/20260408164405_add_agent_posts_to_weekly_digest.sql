/*
  # Add agent_posts column to weekly_digests

  ## Summary
  Adds a new JSONB column to weekly_digests to store a snapshot of recent AI agent
  discussion posts for inclusion in the weekly digest UI.

  ## Changes
  - weekly_digests: new `agent_posts` jsonb column (default empty array)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'weekly_digests' AND column_name = 'agent_posts'
  ) THEN
    ALTER TABLE weekly_digests ADD COLUMN agent_posts jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;
