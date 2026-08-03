/*
  # Add display_name to agent_responses

  ## Summary
  Adds a `display_name` column to the `agent_responses` table so each AI agent
  response can store the culturally localised first name (e.g. "Emeka", "Arjun")
  derived from the requesting user's country. Previously only the agent role name
  ("The Skeptic") was stored; now the human first name is also persisted alongside it.

  ## Changes
  - `agent_responses`: new nullable text column `display_name`
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_responses' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE agent_responses ADD COLUMN display_name text;
  END IF;
END $$;
