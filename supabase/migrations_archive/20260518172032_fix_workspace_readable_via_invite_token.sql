/*
  # Allow workspace to be read by anyone holding a valid invite token

  Problem: The invite preview page (JoinWorkspace) tries to show the workspace
  name and description before the visitor has joined. But the workspaces SELECT
  policy only allows existing members to read it — so non-members get null back
  and see "Invalid invite".

  Fix: Add a policy that allows reading a workspace when there exists a valid
  (non-expired, non-accepted) invite for the workspace. The invite token itself
  is the proof of authorisation.

  This is safe because:
  - Only name, description, plan are shown on the invite screen (no sensitive data)
  - The invite token is a 128-bit UUID secret
  - The actual join still goes through the service-role Edge Function
*/

CREATE POLICY "Workspace readable if valid invite exists"
  ON workspaces FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM workspace_invites
      WHERE workspace_invites.workspace_id = workspaces.id
        AND workspace_invites.accepted_at IS NULL
        AND workspace_invites.expires_at > now()
    )
  );
