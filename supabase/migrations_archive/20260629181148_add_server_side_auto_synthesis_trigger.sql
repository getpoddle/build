-- Track pending auto-synthesis jobs so we can debounce server-side
-- and show "agents are still responding" state to users who navigate back.

CREATE TABLE IF NOT EXISTS workspace_synthesis_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  triggered_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','done','failed')),
  completed_at timestamptz,
  UNIQUE (workspace_id, status) -- only one pending/running per workspace at a time (partial)
);

-- Only allow one pending OR running entry per workspace at a time
CREATE UNIQUE INDEX IF NOT EXISTS workspace_synthesis_queue_active_idx
  ON workspace_synthesis_queue (workspace_id)
  WHERE status IN ('pending', 'running');

ALTER TABLE workspace_synthesis_queue ENABLE ROW LEVEL SECURITY;

-- Workspace members can read the queue to show "synthesis in progress" state
CREATE POLICY "members_can_read_synthesis_queue"
  ON workspace_synthesis_queue FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspace_synthesis_queue.workspace_id
        AND workspace_members.user_id = auth.uid()
    )
  );

-- Only service role inserts/updates (done by edge functions)
CREATE POLICY "service_role_manage_synthesis_queue"
  ON workspace_synthesis_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
