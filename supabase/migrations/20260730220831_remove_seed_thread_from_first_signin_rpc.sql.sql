/*
# Remove seed thread from create_first_signin_workspace

## Change
Drop the seed-thread insert block (the random prompt + canned AI
responses) from the first-sign-in RPC. New users now arrive at an
empty chat with the suggestion cards visible, instead of seeing a
pre-filled message and AI replies they never wrote.

Workspace auto-creation, trial setup, owner membership, and the
onboarded flag are unchanged.
*/

CREATE OR REPLACE FUNCTION public.create_first_signin_workspace(
  p_user_id uuid,
  p_workspace_name text
)
RETURNS TABLE (
  workspace_id uuid,
  first_signin boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_existing_workspace_id uuid;
  v_workspace_id uuid;
  v_trial_expires_at timestamptz;
  v_lock_key bigint;
  v_now timestamptz := now();
BEGIN
  SELECT ('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint
    INTO v_lock_key;

  PERFORM pg_advisory_xact_lock(v_lock_key);

  SELECT wm.workspace_id
    INTO v_existing_workspace_id
    FROM workspace_members wm
    WHERE wm.user_id = p_user_id
    LIMIT 1;

  IF v_existing_workspace_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_workspace_id, false;
    RETURN;
  END IF;

  v_trial_expires_at := v_now + interval '7 days';

  INSERT INTO workspaces (
    name, description, domain, owner_id, plan, seats,
    workspace_type, is_encrypted,
    subscription_status, trial_workspace_expires_at, source,
    created_at, updated_at
  )
  VALUES (
    COALESCE(NULLIF(TRIM(p_workspace_name), ''), 'My Workspace'),
    '', 'general', p_user_id, 'pro', 3,
    'encrypted', true,
    'trialing', v_trial_expires_at, 'app',
    v_now, v_now
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role, joined_at)
  VALUES (v_workspace_id, p_user_id, 'owner', v_now);

  UPDATE profiles SET onboarded = true WHERE id = p_user_id;

  RETURN QUERY SELECT v_workspace_id, true;
  RETURN;
END;
$$;
