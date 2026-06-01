/*
  # Add workspace_memory table

  ## Purpose
  Stores a compact, rolling AI-generated memory for each workspace so agents
  can recall key decisions, agreements, and open threads across sessions.
  This prevents siloed conversations — every chat call reads this memory and
  agents respond with continuity.

  ## New Tables
  - `workspace_memory`
    - `workspace_id` (uuid, PK, FK → workspaces)
    - `decisions` (text[]) — key decisions the team has reached
    - `agreements` (text[]) — shared beliefs / consensus points established
    - `open_threads` (text[]) — unresolved questions still being worked on
    - `key_entities` (text[]) — people, products, markets, milestones mentioned
    - `summary` (text) — 2-3 sentence plain-English summary of what has been discussed
    - `updated_at` (timestamptz)
    - `synthesis_count` (int) — how many times memory has been updated

  ## Security
  - RLS enabled
  - Members of the workspace can read; only service role writes (via synthesize function)
*/

CREATE TABLE IF NOT EXISTS workspace_memory (
  workspace_id    uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  decisions       text[] NOT NULL DEFAULT '{}',
  agreements      text[] NOT NULL DEFAULT '{}',
  open_threads    text[] NOT NULL DEFAULT '{}',
  key_entities    text[] NOT NULL DEFAULT '{}',
  summary         text,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  synthesis_count int NOT NULL DEFAULT 0
);

ALTER TABLE workspace_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read memory"
  ON workspace_memory FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_memory.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_workspace_memory_workspace_id ON workspace_memory(workspace_id);
