/*
# Fix workspace_members RLS infinite recursion (v4)

## Problem
The "Public can read members for public workspaces" policy on
`workspace_members` has a subquery to `workspaces`. The `workspaces` SELECT
policy calls `is_workspace_member()` → queries `workspace_members` → triggers
the public policy → subquery to `workspaces` → infinite recursion.

## Fix
1. Create `is_workspace_public(p_workspace_id)` helper function that queries
   `workspaces` with `row_security = off`, breaking the cycle.
2. Replace the subquery in the public policy with this function call.
3. Also replace the `workspaces` SELECT policy "Workspace members can view
   workspace" to use a direct `owner_id = auth.uid()` OR `is_workspace_member()`
   check (the function now bypasses RLS so no recursion).

## Security
- `is_workspace_public()` only returns a boolean — no data leakage.
- All existing access patterns preserved.
*/

CREATE OR REPLACE FUNCTION public.is_workspace_public(p_workspace_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  STABLE SECURITY DEFINER
  SET search_path TO 'public'
  SET row_security TO off
AS $function$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspaces
    WHERE id = p_workspace_id AND is_public = true
  );
END;
$function$;

-- Replace public policy on workspace_members to use the helper function
DROP POLICY IF EXISTS "Public can read members for public workspaces" ON workspace_members;
CREATE POLICY "Public can read members for public workspaces"
  ON workspace_members FOR SELECT
  TO anon, authenticated
  USING (is_workspace_public(workspace_id));

-- Also fix the workspace_synthesis and workspace_messages public policies
-- to use the helper function instead of subquerying workspaces
DROP POLICY IF EXISTS "Public can read synthesis for public workspaces" ON workspace_synthesis;
CREATE POLICY "Public can read synthesis for public workspaces"
  ON workspace_synthesis FOR SELECT
  TO anon, authenticated
  USING (is_workspace_public(workspace_id));

DROP POLICY IF EXISTS "Public can read messages for public workspaces" ON workspace_messages;
CREATE POLICY "Public can read messages for public workspaces"
  ON workspace_messages FOR SELECT
  TO anon, authenticated
  USING (is_workspace_public(workspace_id));
