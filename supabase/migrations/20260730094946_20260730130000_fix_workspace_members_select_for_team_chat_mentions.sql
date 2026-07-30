/*
# Fix workspace_members SELECT policy so team chat @mentions work

## Problem
The "Members can view other members of their workspace" SELECT policy on
`workspace_members` was restricted to `user_id = auth.uid()` — a user could
only read their OWN membership row, not other members' rows. This broke the
team chat @mention picker: when TeamChat queries workspace_members to build
the member list, it only received the current user, so `otherMembers` was
empty and the @ dropdown showed no one to mention.

## Fix
Replace the policy with one that lets any authenticated workspace member
read ALL member rows of workspaces they belong to, using the existing
recursion-safe `is_workspace_member()` helper (which runs with
`row_security = off`, so no infinite recursion).

## Security
- A user can only read members of workspaces they are themselves a member of.
- Public workspaces remain readable via the existing
  "Public can read members for public workspaces" policy (unchanged).
- No data leakage: membership rows are not sensitive.
*/

DROP POLICY IF EXISTS "Members can view other members of their workspace" ON workspace_members;

CREATE POLICY "Members can view other members of their workspace"
  ON workspace_members FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));
