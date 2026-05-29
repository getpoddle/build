/*
  # Workspace RLS Policies

  Adds Row Level Security policies for all workspace tables.
  Uses SECURITY DEFINER helper functions to avoid infinite recursion
  in workspace_members self-referential policies.
*/

-- workspaces: members can view workspaces they belong to
CREATE POLICY "Workspace members can view workspace"
  ON workspaces FOR SELECT
  TO authenticated
  USING (is_workspace_member(id, auth.uid()));

CREATE POLICY "Authenticated users can create workspaces"
  ON workspaces FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owner can update workspace"
  ON workspaces FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Workspace owner can delete workspace"
  ON workspaces FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- workspace_members: use helper function to avoid recursion
CREATE POLICY "Members can view other members of their workspace"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Owner and admins can insert members"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    OR get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Owner and admins can update member roles"
  ON workspace_members FOR UPDATE
  TO authenticated
  USING (get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'))
  WITH CHECK (get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Members can leave, admins can remove members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    OR get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

-- workspace_invites policies
CREATE POLICY "Workspace admins can view invites"
  ON workspace_invites FOR SELECT
  TO authenticated
  USING (
    get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "Workspace admins can create invites"
  ON workspace_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin')
  );

CREATE POLICY "Workspace admins can delete invites"
  ON workspace_invites FOR DELETE
  TO authenticated
  USING (get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'));

CREATE POLICY "Invited user can accept invite"
  ON workspace_invites FOR UPDATE
  TO authenticated
  USING (invited_email = (SELECT email FROM profiles WHERE id = auth.uid()))
  WITH CHECK (invited_email = (SELECT email FROM profiles WHERE id = auth.uid()));

-- workspace_entities policies
CREATE POLICY "Workspace members can view workspace entities"
  ON workspace_entities FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can add entities"
  ON workspace_entities FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace admins can remove entities"
  ON workspace_entities FOR DELETE
  TO authenticated
  USING (get_workspace_role(workspace_id, auth.uid()) IN ('owner', 'admin'));
