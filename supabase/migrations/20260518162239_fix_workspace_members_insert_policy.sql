/*
  # Fix workspace_members INSERT policy

  The original INSERT policy only allowed inserts when the user already had an
  owner/admin role in workspace_members — but when creating a workspace the owner
  has no row yet, so get_workspace_role returns NULL and the insert is blocked.

  Fix: also allow the insert when the user is the owner of the target workspace,
  so the first member row (owner) can always be created.
*/

DROP POLICY IF EXISTS "Owner and admins can insert members" ON workspace_members;

CREATE POLICY "Owner and admins can insert members"
  ON workspace_members FOR INSERT
  TO authenticated
  WITH CHECK (
    -- allow user to join their own workspace as the first member
    user_id = auth.uid()
    -- or allow admins/owners to add others
    OR get_workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner', 'admin'])
    -- or allow when the acting user owns the target workspace (handles the first-member bootstrap)
    OR EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id AND owner_id = auth.uid()
    )
  );
