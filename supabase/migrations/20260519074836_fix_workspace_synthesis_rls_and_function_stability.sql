/*
  # Fix workspace_synthesis RLS and helper function stability

  1. Changes
    - workspace_synthesis: adds missing INSERT and UPDATE policies so members
      cannot accidentally write via client (defence-in-depth), and fixes the
      SELECT policy to use a stable, non-recursive path.
    - is_workspace_member / get_workspace_role: sets SECURITY DEFINER +
      SET search_path = public so they run with a stable execution context
      and avoid potential infinite-recursion via RLS on workspace_members.

  2. Security
    - Only workspace members (via service-role edge function) can write synthesis.
    - Direct client writes are blocked — INSERT/UPDATE policies are intentionally
      restrictive (only owner can do so via client, edge function uses service role).
*/

-- Re-create helper functions with stable search_path to prevent recursion
CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION get_workspace_role(p_workspace_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  RETURN v_role;
END;
$$;

-- Drop any existing policies on workspace_synthesis so we can re-create cleanly
DROP POLICY IF EXISTS "Workspace members can read synthesis" ON workspace_synthesis;
DROP POLICY IF EXISTS "Service role can write synthesis" ON workspace_synthesis;
DROP POLICY IF EXISTS "Workspace owner can insert synthesis" ON workspace_synthesis;
DROP POLICY IF EXISTS "Workspace owner can update synthesis" ON workspace_synthesis;

-- SELECT: any workspace member can read
CREATE POLICY "Workspace members can read synthesis"
  ON workspace_synthesis FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

-- INSERT: only workspace owner via client (edge function uses service_role and bypasses RLS)
CREATE POLICY "Workspace owner can insert synthesis"
  ON workspace_synthesis FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id AND owner_id = auth.uid()
    )
  );

-- UPDATE: only workspace owner via client
CREATE POLICY "Workspace owner can update synthesis"
  ON workspace_synthesis FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id AND owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspaces
      WHERE id = workspace_id AND owner_id = auth.uid()
    )
  );
