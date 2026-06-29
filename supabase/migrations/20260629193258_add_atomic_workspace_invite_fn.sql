-- Atomically checks the seat limit and inserts the invite record in one
-- serializable transaction, preventing race conditions where two concurrent
-- calls could both pass the seat check before either insert completes.
CREATE OR REPLACE FUNCTION create_workspace_invite(
  p_workspace_id uuid,
  p_invited_email text,
  p_invited_by uuid
)
RETURNS TABLE(token uuid, error text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_seats int;
  v_member_count int;
  v_pending_count int;
  v_token uuid;
BEGIN
  -- Lock the workspace row to serialize concurrent invite creation
  SELECT seats INTO v_seats
  FROM workspaces
  WHERE id = p_workspace_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::uuid, 'Workspace not found'::text;
    RETURN;
  END IF;

  SELECT COUNT(*) INTO v_member_count
  FROM workspace_members
  WHERE workspace_id = p_workspace_id;

  SELECT COUNT(*) INTO v_pending_count
  FROM workspace_invites
  WHERE workspace_id = p_workspace_id
    AND accepted_at IS NULL
    AND expires_at > now();

  IF (v_member_count + v_pending_count) >= v_seats THEN
    RETURN QUERY SELECT NULL::uuid, 'No seats available'::text;
    RETURN;
  END IF;

  INSERT INTO workspace_invites (workspace_id, invited_email, invited_by)
  VALUES (p_workspace_id, p_invited_email, p_invited_by)
  RETURNING workspace_invites.token INTO v_token;

  RETURN QUERY SELECT v_token, NULL::text;
END;
$$;

REVOKE ALL ON FUNCTION create_workspace_invite(uuid, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_workspace_invite(uuid, text, uuid) TO authenticated;
