
-- Maps Slack workspaces to Poddle workspaces
CREATE TABLE IF NOT EXISTS slack_workspaces (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poddle_workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  slack_team_id        text UNIQUE NOT NULL,
  slack_team_name      text,
  bot_access_token     text NOT NULL,
  installed_by_user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  default_channel_id   text,
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_workspaces_poddle_workspace ON slack_workspaces(poddle_workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_workspaces_team_id          ON slack_workspaces(slack_team_id);

ALTER TABLE slack_workspaces ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_slack_workspaces" ON slack_workspaces FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = poddle_workspace_id AND wm.user_id = auth.uid()
    )
  );

CREATE POLICY "insert_slack_workspaces" ON slack_workspaces FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = poddle_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "update_slack_workspaces" ON slack_workspaces FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = poddle_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = poddle_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

CREATE POLICY "delete_slack_workspaces" ON slack_workspaces FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = poddle_workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Tracks individual slash command invocations and their lifecycle
CREATE TABLE IF NOT EXISTS slack_sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_workspace_id   uuid NOT NULL REFERENCES slack_workspaces(id) ON DELETE CASCADE,
  synthesis_id         uuid REFERENCES workspace_synthesis(id) ON DELETE SET NULL,
  slack_user_id        text NOT NULL,
  slack_channel_id     text NOT NULL,
  response_url         text NOT NULL,
  decision_question    text,
  status               text NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at           timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_slack_sessions_slack_workspace ON slack_sessions(slack_workspace_id);
CREATE INDEX IF NOT EXISTS idx_slack_sessions_synthesis      ON slack_sessions(synthesis_id);
CREATE INDEX IF NOT EXISTS idx_slack_sessions_status         ON slack_sessions(status, created_at DESC);

ALTER TABLE slack_sessions ENABLE ROW LEVEL SECURITY;

-- Only workspace admins can read sessions; inserts/updates happen via service role in edge functions
CREATE POLICY "select_slack_sessions" ON slack_sessions FOR SELECT
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM slack_workspaces sw
      JOIN workspace_members wm ON wm.workspace_id = sw.poddle_workspace_id
      WHERE sw.id = slack_workspace_id AND wm.user_id = auth.uid()
    )
  );
