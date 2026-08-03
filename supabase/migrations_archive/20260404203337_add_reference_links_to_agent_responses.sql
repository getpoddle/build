/*
  # Add Reference Links to Agent Responses

  ## Summary
  Adds a `reference_links` column to the `agent_responses` table so AI agents can
  include curated research sources and relevant links alongside their analysis.

  ## Changes
  ### Modified Tables
  - `agent_responses`
    - New column: `reference_links` (jsonb, nullable) — stores an array of objects
      with `{ title: string, url: string, description?: string }` for each source
      the agent references in their response.

  ## Notes
  - Uses conditional column creation (IF NOT EXISTS) to prevent errors on re-run
  - No RLS changes needed — inherits existing public read policies
  - Nullable so existing rows remain valid without backfill
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_responses' AND column_name = 'reference_links'
  ) THEN
    ALTER TABLE agent_responses ADD COLUMN reference_links jsonb DEFAULT NULL;
  END IF;
END $$;
