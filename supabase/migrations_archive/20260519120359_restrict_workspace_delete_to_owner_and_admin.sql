/*
  # Restrict workspace deletion to owner and admins only

  ## Changes

  1. workspaces DELETE policy
     - Drops: "Workspace owner can delete workspace" (owner_id = auth.uid() only)
     - Creates: "Workspace owner or admin can delete workspace"
       Allows deletion when the user is the owner OR holds the 'owner'/'admin' role
       in workspace_members (via the stable get_workspace_role helper)

  2. workspace_members DELETE policy
     - Drops: "Members can leave, admins can remove members"
       (allowed any member to delete themselves OR admins to remove others)
     - Creates two focused policies:
       a. "Members can leave workspace" — user_id = auth.uid() AND role != 'owner'
          (owners cannot accidentally leave — they must transfer ownership or delete)
       b. "Admins can remove non-owner members" — caller is owner/admin AND target is not owner

  ## Security
  - Regular 'member' role users can still leave a workspace they joined
  - Regular 'member' role users cannot delete the workspace itself
  - 'owner' and 'admin' roles can both delete the workspace
  - Owners cannot be removed by admins (only by themselves via workspace deletion)
*/

-- ── workspaces DELETE ────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Workspace owner can delete workspace" ON workspaces;

CREATE POLICY "Workspace owner or admin can delete workspace"
  ON workspaces FOR DELETE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR get_workspace_role(id, auth.uid()) = ANY (ARRAY['owner', 'admin'])
  );

-- ── workspace_members DELETE ─────────────────────────────────────────────────

DROP POLICY IF EXISTS "Members can leave, admins can remove members" ON workspace_members;

-- Any non-owner member can leave (delete their own row)
CREATE POLICY "Members can leave workspace"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (
    user_id = auth.uid()
    AND role != 'owner'
  );

-- Owners and admins can remove other members, but cannot remove owners
CREATE POLICY "Admins can remove non-owner members"
  ON workspace_members FOR DELETE
  TO authenticated
  USING (
    user_id != auth.uid()
    AND role != 'owner'
    AND get_workspace_role(workspace_id, auth.uid()) = ANY (ARRAY['owner', 'admin'])
  );
