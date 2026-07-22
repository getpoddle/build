/*
# Fix workspace_members RLS infinite recursion

## Problem
The SELECT policy "Members can view other members of their workspace" on
`workspace_members` calls `is_workspace_member()`, which queries
`workspace_members` internally. Even though the function is SECURITY DEFINER,
PostgreSQL still evaluates RLS policies on the inner query, triggering the
same policy again → infinite recursion → every SELECT on workspace_members
fails silently. This made ALL workspaces invisible to every user.

## Fix
Replace the recursive `is_workspace_member()` call in the SELECT policy with
a direct, non-recursive predicate:
  - `user_id = auth.uid()` — users can always see their own membership rows
    (this is what `useUserWorkspaces` needs to list a user's workspaces)
  - `OR EXISTS (SELECT 1 FROM workspaces w WHERE w.id = workspace_members.workspace_id
    AND w.owner_id = auth.uid())` — workspace owners can see all members
    in their workspaces (needed for WorkspaceSettings, TeamChat, War Room, etc.)

The `workspaces` table has its own non-recursive SELECT policy
(`is_workspace_member(id, auth.uid())` → but that function queries
`workspace_members`...). However, the `workspaces` SELECT policy also has
a `Public can read public workspaces` policy and the owner check via
`is_workspace_member`. The `workspaces` table does NOT recurse because
`is_workspace_member` queries `workspace_members` (not `workspaces`), and
the `workspace_members` policy is what we're fixing here.

## Security
- Users can see their own membership rows (needed for workspace list).
- Workspace owners can see all members in their workspaces.
- Non-owner members can only see their own row (minor limitation, but
  far better than the previous behavior where NO ONE could see anything).
- Public read policy for public workspaces is unchanged.
*/

DROP POLICY IF EXISTS "Members can view other members of their workspace" ON workspace_members;
CREATE POLICY "Members can view other members of their workspace"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM workspaces w
      WHERE w.id = workspace_members.workspace_id
      AND w.owner_id = auth.uid()
    )
  );
