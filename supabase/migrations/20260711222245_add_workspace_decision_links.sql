
CREATE TABLE IF NOT EXISTS workspace_decision_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  linked_workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'related_to'
    CHECK (relationship_type IN ('influences', 'depends_on', 'conflicts_with', 'related_to')),
  note text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT no_self_link CHECK (workspace_id <> linked_workspace_id),
  CONSTRAINT unique_link UNIQUE (workspace_id, linked_workspace_id)
);

CREATE INDEX idx_wdl_workspace_id ON workspace_decision_links(workspace_id);
CREATE INDEX idx_wdl_linked_workspace_id ON workspace_decision_links(linked_workspace_id);

ALTER TABLE workspace_decision_links ENABLE ROW LEVEL SECURITY;

-- Members of either workspace can read links involving their workspaces
CREATE POLICY "read_links_if_member" ON workspace_decision_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND (wm.workspace_id = workspace_decision_links.workspace_id
          OR wm.workspace_id = workspace_decision_links.linked_workspace_id)
    )
  );

-- Owners/admins of the source workspace can create links
CREATE POLICY "create_link_if_owner_or_admin" ON workspace_decision_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = workspace_decision_links.workspace_id
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Owners/admins of the source workspace can delete links
CREATE POLICY "delete_link_if_owner_or_admin" ON workspace_decision_links FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.user_id = auth.uid()
        AND wm.workspace_id = workspace_decision_links.workspace_id
        AND wm.role IN ('owner', 'admin')
    )
  );
