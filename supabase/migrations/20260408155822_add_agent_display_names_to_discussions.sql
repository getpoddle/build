/*
  # Add Agent Display Names to AI Agent Discussions

  ## Summary
  Adds a column to store human-readable display names (location-based first names)
  for the AI agents in a discussion. This allows the frontend to show human names
  instead of "AI Analysts" or role names.

  ## Modified Tables
  - `ai_agent_discussions` - added agent_display_names (jsonb array of human first names)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'agent_display_names'
  ) THEN
    ALTER TABLE ai_agent_discussions ADD COLUMN agent_display_names jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;
