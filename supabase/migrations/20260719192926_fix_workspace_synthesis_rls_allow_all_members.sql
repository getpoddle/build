-- Allow all workspace members (not just the owner) to insert and update
-- synthesis rows. The edge function uses the service role key (bypassing
-- RLS), but client-side code paths and future triggers may need member
-- access. The SELECT policy already uses is_workspace_member; align the
-- INSERT and UPDATE policies the same way.

DROP POLICY IF EXISTS "Workspace owner can insert synthesis" ON workspace_synthesis;
DROP POLICY IF EXISTS "Workspace owner can update synthesis" ON workspace_synthesis;

CREATE POLICY "Workspace members can insert synthesis"
  ON workspace_synthesis FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can update synthesis"
  ON workspace_synthesis FOR UPDATE
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()));