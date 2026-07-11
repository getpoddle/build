-- Allow workspace owners AND admins to update the workspace row.
-- Admins need this to change decision_category / decision_status via the Decision Map.
-- Billing fields are still protected by the protect_subscription_fields_workspaces trigger.

DROP POLICY IF EXISTS "Workspace owner can update workspace" ON workspaces;

CREATE POLICY "Workspace owner or admin can update workspace" ON workspaces
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspace_members
      WHERE workspace_members.workspace_id = workspaces.id
        AND workspace_members.user_id = auth.uid()
        AND workspace_members.role IN ('owner', 'admin')
    )
  );
