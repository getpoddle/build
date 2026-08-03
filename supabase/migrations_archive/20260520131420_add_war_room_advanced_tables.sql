/*
  # War Room Advanced Intelligence Tables

  ## New Tables

  1. `workspace_synthesis_history`
     - Permanent record of every synthesis run per workspace
     - Tracks score progression, counts per section, and message volume
     - Powers the health score trend sparkline and resolved-question counter

  2. `workspace_action_items`
     - AI-suggested and team-created action items linked to synthesis runs
     - Supports assignee, due date, status cycling (todo/in_progress/done)
     - source: 'ai' for agent-generated, 'manual' for team-added

  3. `workspace_conflict_commits`
     - Formal team commitment to one side of a conflict zone
     - Persists which position the team chose and who committed

  ## Schema Changes
     - `workspace_synthesis.action_items` jsonb column added

  ## Security
     - RLS enabled on all tables
     - All read/write restricted to workspace members
     - Action item status updates allowed by any workspace member
*/

-- ─── workspace_synthesis_history ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_synthesis_history (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_health_score int NOT NULL DEFAULT 0,
  consensus_count      int NOT NULL DEFAULT 0,
  conflict_count       int NOT NULL DEFAULT 0,
  open_question_count  int NOT NULL DEFAULT 0,
  risk_count           int NOT NULL DEFAULT 0,
  blind_spot_count     int NOT NULL DEFAULT 0,
  message_count        int NOT NULL DEFAULT 0,
  generated_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_synthesis_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wsh_workspace_generated
  ON workspace_synthesis_history(workspace_id, generated_at);

CREATE POLICY "Workspace members can read synthesis history"
  ON workspace_synthesis_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_synthesis_history.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- ─── workspace_synthesis.action_items column ────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspace_synthesis' AND column_name = 'action_items'
  ) THEN
    ALTER TABLE workspace_synthesis ADD COLUMN action_items jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- ─── workspace_action_items ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_action_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  text                text NOT NULL,
  source              text NOT NULL DEFAULT 'manual' CHECK (source IN ('ai', 'manual')),
  priority            text NOT NULL DEFAULT 'medium' CHECK (priority IN ('critical', 'high', 'medium', 'low')),
  source_area         text CHECK (source_area IN ('risk', 'blind_spot', 'open_question', 'conflict', 'manual')),
  assignee_user_id    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  due_date            date,
  status              text NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'done')),
  synthesis_run_id    uuid REFERENCES workspace_synthesis_history(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_action_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wai_workspace_status
  ON workspace_action_items(workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_wai_assignee
  ON workspace_action_items(assignee_user_id);

CREATE POLICY "Workspace members can read action items"
  ON workspace_action_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_action_items.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can insert action items"
  ON workspace_action_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_action_items.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can update action items"
  ON workspace_action_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_action_items.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_action_items.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can delete own manual action items"
  ON workspace_action_items FOR DELETE
  TO authenticated
  USING (
    created_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_action_items.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- ─── workspace_conflict_commits ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS workspace_conflict_commits (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  conflict_topic      text NOT NULL,
  committed_position  text NOT NULL,
  committed_side      text NOT NULL CHECK (committed_side IN ('a', 'b')),
  committed_by        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  committed_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(workspace_id, conflict_topic)
);

ALTER TABLE workspace_conflict_commits ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_wcc_workspace
  ON workspace_conflict_commits(workspace_id);

CREATE POLICY "Workspace members can read conflict commits"
  ON workspace_conflict_commits FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_conflict_commits.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can insert conflict commits"
  ON workspace_conflict_commits FOR INSERT
  TO authenticated
  WITH CHECK (
    committed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_conflict_commits.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Workspace members can delete conflict commits"
  ON workspace_conflict_commits FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_conflict_commits.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );
