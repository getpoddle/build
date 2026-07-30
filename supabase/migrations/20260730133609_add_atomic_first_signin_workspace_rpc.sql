/*
# Atomic first-sign-in workspace creation

## Problem
The `first-sign-in` edge function is called twice concurrently (within ~140ms)
when a new user confirms their email and auto-signs in. Both calls pass the
"does this user already have a workspace?" check before either has inserted,
resulting in two duplicate workspaces for the same user.

## Fix
Create a `create_first_signin_workspace(p_user_id uuid, p_workspace_name text)`
RPC that atomically:
1. Acquires a transaction-level advisory lock keyed to the user's UUID.
2. Re-checks for an existing workspace membership (inside the lock).
3. If none exists, inserts the workspace + owner membership + seed thread.
4. Returns `{ workspace_id, first_signin }`.

Only one concurrent call can hold the lock; the other waits, then sees the
row the first call created and returns `first_signin = false`.

## Security
- Function is `SECURITY DEFINER` so it can insert into `workspaces` and
  `workspace_members` regardless of RLS.
- `search_path` is locked to `public`.
- No new tables or columns.
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

  v_trial_expires_at := now() + interval '7 days';

  INSERT INTO workspaces (
    name, description, domain, owner_id, plan, seats,
    workspace_type, is_encrypted,
    subscription_status, trial_workspace_expires_at, source
  )
  VALUES (
    COALESCE(NULLIF(TRIM(p_workspace_name), ''), 'My Workspace'),
    '', 'general', p_user_id, 'pro', 3,
    'encrypted', true,
    'trialing', v_trial_expires_at, 'app'
  )
  RETURNING id INTO v_workspace_id;

  INSERT INTO workspace_members (workspace_id, user_id, role)
  VALUES (v_workspace_id, p_user_id, 'owner');

  -- Seed thread
  INSERT INTO workspace_messages (workspace_id, user_id, role, content)
  SELECT v_workspace_id, p_user_id, 'user', seed.prompt
  FROM workspace_seed_threads seed
  ORDER BY random()
  LIMIT 1;

  -- Seed assistant responses (bulk insert)
  INSERT INTO workspace_messages (workspace_id, user_id, role, content, agent_name, agent_role)
  SELECT v_workspace_id, NULL, 'assistant', r.content, r.agent_name, r.agent_role
  FROM workspace_seed_threads seed,
       LATERAL jsonb_array_elements(seed.responses) AS r
  WHERE seed.id = (
    SELECT id FROM workspace_seed_threads
    WHERE prompt = (
      SELECT content FROM workspace_messages
      WHERE workspace_id = v_workspace_id AND role = 'user'
      ORDER BY created_at DESC LIMIT 1
    )
    LIMIT 1
  );

  -- Mark profile as onboarded
  UPDATE profiles SET onboarded = true WHERE id = p_user_id;

  RETURN QUERY SELECT v_workspace_id, true;
  RETURN;
END;
$$;
