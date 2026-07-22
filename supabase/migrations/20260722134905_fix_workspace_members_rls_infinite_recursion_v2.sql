/*
# Fix workspace_members RLS infinite recursion (v2)

## Problem
The `workspace_members` SELECT policy references `workspaces`, and the
`workspaces` SELECT policy calls `is_workspace_member()` which queries
`workspace_members` → mutual recursion → infinite loop → all workspaces
invisible to all users.

Even though `is_workspace_member()` and `get_workspace_role()` are
SECURITY DEFINER owned by postgres (bypassrls=true), PostgreSQL does NOT
automatically apply BYPASSRLS inside SECURITY DEFINER functions unless
`row_security` is explicitly set to `off` in the function body.

## Fix
1. Recreate `is_workspace_member()` and `get_workspace_role()` with
   `SET row_security = off` so they bypass RLS when querying
   `workspace_members`, breaking the recursive cycle.
2. Simplify the `workspace_members` SELECT policy to use a direct
   `user_id = auth.uid()` check plus an owner check via `workspaces`
   (which is now safe because `is_workspace_member` bypasses RLS).

## Security
- `is_workspace_member()` and `get_workspace_role()` are SECURITY DEFINER
  owned by postgres. They only expose a boolean/role for a specific
  workspace+user pair — no data leakage.
- Users can see their own membership rows (needed for workspace list).
- Workspace owners can see all members in their workspaces.
- Public read policy for public workspaces is unchanged.
*/

-- 1. Recreate helper functions with row_security = off
CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO off
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_workspace_role(p_workspace_id uuid, p_user_id uuid)
  RETURNS text
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO off
AS $function$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  RETURN v_role;
END;
$function$;

-- 2. Simplify workspace_members SELECT policy (no recursion)
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
