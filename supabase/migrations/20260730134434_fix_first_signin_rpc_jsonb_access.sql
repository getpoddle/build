/*
# Fix create_first_signin_workspace RPC

## Problem
The seed assistant-responses INSERT used `r.content`, `r.agent_name`,
`r.agent_role` — but `jsonb_array_elements()` returns jsonb values,
not composite records. The correct field-access syntax is `r->>'content'`
etc. The wrong syntax causes a runtime error that aborts the entire
function, so no workspace is created for any new user.

## Fix
Rewrite the seed-insert block to match the proven approach from the
original `handle_new_user` trigger: select a random seed thread into
local variables, then insert the user prompt and the assistant
responses in two simple INSERTs using `->>` for jsonb field access.
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
  v_seed_prompt text;
  v_seed_responses jsonb;
  v_now timestamptz := now();
BEGIN
  -- Derive a stable 64-bit lock key from the user's UUID.
  SELECT ('x' || substr(md5(p_user_id::text), 1, 16))::bit(64)::bigint
    INTO v_lock_key;

  -- Transaction-level advisory lock: only one call per user proceeds at a time.
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Re-check inside the lock: does the user already have a workspace?
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

  -- Seed an example AI Collaboration thread (same logic as handle_new_user)
  SELECT prompt, responses
    INTO v_seed_prompt, v_seed_responses
  FROM workspace_seed_threads
  ORDER BY random()
  LIMIT 1;

  IF v_seed_prompt IS NOT NULL THEN
    INSERT INTO workspace_messages (workspace_id, user_id, role, content, created_at)
    VALUES (v_workspace_id, p_user_id, 'user', v_seed_prompt, v_now);

    INSERT INTO workspace_messages (workspace_id, user_id, role, content, agent_name, agent_role, created_at)
    SELECT
      v_workspace_id, NULL, 'assistant',
      elem->>'content',
      elem->>'agent_name',
      elem->>'agent_role',
      v_now + (interval '1 second' * row_number() OVER ())
    FROM jsonb_array_elements(v_seed_responses) AS elem;
  END IF;

  -- Mark profile as onboarded
  UPDATE profiles SET onboarded = true WHERE id = p_user_id;

  RETURN QUERY SELECT v_workspace_id, true;
  RETURN;
END;
$$;
