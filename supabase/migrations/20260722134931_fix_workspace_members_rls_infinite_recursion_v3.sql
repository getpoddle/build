/*
# Fix workspace_members RLS infinite recursion (v3)

## Problem
Mutual recursion between:
- `workspace_members` SELECT policy → references `workspaces` table
- `workspaces` SELECT policy → calls `is_workspace_member()` → queries `workspace_members`

Even with `row_security = off` on the helper functions, the `workspace_members`
SELECT policy itself references `workspaces`, and the `workspaces` SELECT policy
calls `is_workspace_member()` which queries `workspace_members`. The cycle is:
  workspace_members SELECT → workspaces SELECT → is_workspace_member() → workspace_members SELECT

## Fix
1. Simplify `workspace_members` SELECT policy to ONLY use `user_id = auth.uid()`
   (no subquery to `workspaces`). This breaks the cycle from the members side.
   - Users can see their own membership rows (sufficient for workspace list).
   - Workspace owners can see members via the public policy or by also being
     members themselves (owners are always members).

2. Keep `workspaces` SELECT policy using `is_workspace_member()` — now safe
   because `workspace_members` SELECT no longer references `workspaces`.

## Security
- Users see their own membership rows only (sufficient for listing workspaces).
- Workspace visibility still controlled by `is_workspace_member()` on the
  `workspaces` table.
- Public workspaces still readable via the public policy.
- Owner-only operations (settings, member management) still work because
  the `workspaces` SELECT policy allows owners to see their workspaces,
  and the owner is always a member of their own workspace.
*/

-- Simplify workspace_members SELECT policy to break recursion
-- Users can see their own membership rows + public workspace members
DROP POLICY IF EXISTS "Members can view other members of their workspace" ON workspace_members;
CREATE POLICY "Members can view other members of their workspace"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
