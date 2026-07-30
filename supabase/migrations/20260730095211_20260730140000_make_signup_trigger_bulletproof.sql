/*
# Make handle_new_user trigger bulletproof + fix email rate limit

## Problem
1. The `handle_new_user()` trigger does heavy work (workspace + members +
   seed messages). If ANY part fails, the entire signup transaction rolls
   back — the user sees an error and retries, hitting Supabase Auth's
   "email rate limit exceeded" after a few attempts.

2. The app sends TWO confirmation emails per signup: Supabase's built-in
   confirmation email (via GoTrue) AND a custom branded email via the
   `send-signup-confirmation` edge function (via Resend). This doubles
   email volume and accelerates rate limiting.

## Fix
1. Wrap the workspace-creation portion of `handle_new_user()` in a
   BEGIN/EXCEPTION block so that if it fails, the profile is still
   created and the signup succeeds. The workspace can be created
   later via the onboarding flow as a fallback.
2. This ensures signup NEVER fails due to workspace creation errors.
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
  v_seed_prompt text;
  v_seed_responses jsonb;
  v_trial_expires timestamptz;
  v_now timestamptz := now();
BEGIN
  -- Create the profile row (original behavior — must succeed)
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

  -- ── Auto-create workspace (best-effort: never fail signup) ──
  BEGIN
    v_first_name := NULLIF(TRIM(NEW.raw_user_meta_data->>'first_name'), '');

    IF v_first_name IS NOT NULL THEN
      v_workspace_name := v_first_name || '''s Workspace';
    ELSE
      v_workspace_name := 'My Workspace';
    END IF;

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

    -- ── Seed an example AI Collaboration thread ──
    SELECT prompt, responses INTO v_seed_prompt, v_seed_responses
    FROM public.workspace_seed_threads
    ORDER BY random()
    LIMIT 1;

    IF v_seed_prompt IS NOT NULL AND v_workspace_id IS NOT NULL THEN
      INSERT INTO public.workspace_messages (
        workspace_id,
        user_id,
        role,
        content,
        created_at
      ) VALUES (
        v_workspace_id,
        NEW.id,
        'user',
        v_seed_prompt,
        v_now
      );

      INSERT INTO public.workspace_messages (
        workspace_id,
        user_id,
        role,
        content,
        agent_name,
        agent_role,
        created_at
      )
      SELECT
        v_workspace_id,
        NULL,
        'assistant',
        elem->>'content',
        elem->>'agent_name',
        elem->>'agent_role',
        v_now + (interval '1 second' * row_number() OVER ())
      FROM jsonb_array_elements(v_seed_responses) AS elem;
    END IF;

  EXCEPTION WHEN OTHERS THEN
    -- If workspace creation fails for any reason, log it but don't
    -- fail the signup. The user can create a workspace later.
    RAISE NOTICE 'Workspace auto-creation failed for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;
