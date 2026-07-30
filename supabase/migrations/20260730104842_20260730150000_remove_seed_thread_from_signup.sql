/*
# Remove pre-seeded AI thread from new workspace creation

## Summary
The `handle_new_user()` trigger currently auto-creates a workspace on signup
AND pre-seeds it with a canned example AI thread (sample prompt + 2 agent
responses). This means every new workspace already has messages in it, so the
empty-state "write your prompt" UI never renders for new users. The product
flow has changed: users should land on a clean workspace, write their own
prompt (or pick a suggestion), and THEN the AI agents generate responses.

This migration removes the seed-thread insertion from `handle_new_user()`.
The workspace is still auto-created and the user added as owner — only the
canned example messages are removed. Existing users and their workspaces are
unaffected; only new signups change behavior.

## Changes
1. Recreate `handle_new_user()` WITHOUT the seed-thread block:
   - Still creates the profile row.
   - Still auto-creates the workspace (named "{first_name}'s Workspace").
   - Still adds the new user as owner in workspace_members.
   - No longer inserts any workspace_messages (no seed prompt, no canned
     agent responses). The workspace starts empty.
2. The `workspace_seed_threads` config table is left in place (harmless) —
   it is simply no longer read by the trigger.

## Security
- No RLS or policy changes.
- The trigger remains SECURITY DEFINER, search_path = public.

## Important Notes
- Existing workspaces keep their existing messages — nothing is deleted.
- Only NEW signups are affected: their workspace will start empty.
- The `workspace_seed_threads` table is not dropped (data safety); it just
  goes unused.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_first_name text;
  v_workspace_name text;
  v_workspace_id uuid;
  v_trial_expires timestamptz;
  v_now timestamptz := now();
BEGIN
  -- Create the profile row (original behavior)
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    first_name,
    last_name,
    username,
    onboarded,
    created_at,
    updated_at
  ) VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NULLIF(TRIM(NEW.raw_user_meta_data->>'full_name'), ''),
      NEW.email
    ),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'last_name'), ''),
    NULLIF(TRIM(NEW.raw_user_meta_data->>'username'), ''),
    true,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO NOTHING;

  -- ── Auto-create workspace ──
  v_first_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '');

  IF v_first_name IS NOT NULL THEN
    v_workspace_name := v_first_name || '''s Workspace';
  ELSE
    v_workspace_name := 'My Workspace';
  END IF;

  -- Trial expires at end of current month
  v_trial_expires := date_trunc('month', v_now) + interval '1 month' - interval '1 second';

  INSERT INTO public.workspaces (
    name,
    description,
    domain,
    owner_id,
    workspace_type,
    is_encrypted,
    plan,
    seats,
    subscription_status,
    trial_workspace_expires_at,
    source,
    created_at,
    updated_at
  ) VALUES (
    v_workspace_name,
    '',
    'general',
    NEW.id,
    'encrypted',
    true,
    'pro',
    3,
    'trialing',
    v_trial_expires,
    'app',
    v_now,
    v_now
  )
  RETURNING id INTO v_workspace_id;

  -- Add the new user as owner
  INSERT INTO public.workspace_members (
    workspace_id,
    user_id,
    role,
    joined_at
  ) VALUES (
    v_workspace_id,
    NEW.id,
    'owner',
    v_now
  );

  -- No seed messages inserted — workspace starts empty so the user
  -- sees the prompt-first empty state in the chat UI.

  RETURN NEW;
END;
$$;
