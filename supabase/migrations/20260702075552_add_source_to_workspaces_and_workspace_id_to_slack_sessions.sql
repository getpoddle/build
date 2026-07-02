
-- Add source column to workspaces to distinguish Slack-created ephemeral workspaces
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app'
  CHECK (source IN ('app', 'slack'));

-- Add poddle_workspace_id to slack_sessions so each session tracks its own workspace
ALTER TABLE slack_sessions
  ADD COLUMN IF NOT EXISTS poddle_workspace_id uuid REFERENCES workspaces(id) ON DELETE SET NULL;

-- Index for fast lookup of Slack-sourced workspaces
CREATE INDEX IF NOT EXISTS idx_workspaces_source ON workspaces(source) WHERE source = 'slack';
CREATE INDEX IF NOT EXISTS idx_slack_sessions_poddle_workspace_id ON slack_sessions(poddle_workspace_id);
