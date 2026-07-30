-- Shared helper: creates a workspace + workspace_members row for a user.
-- Called by handle_new_user (OAuth) and handle_email_confirmed (email signup).

CREATE OR REPLACE FUNCTION public.create_workspace_for_user(
  p_user_id uuid,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_now timestamptz DEFAULT now()
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_first_name text;
  v_workspace_name text;
  v_workspace_id uuid;
  v_trial_expires timestamptz;
  v_existing_count integer;
BEGIN
  -- Don't create a workspace if the user already has one.
  SELECT count(*) INTO v_existing_count
  FROM public.workspaces
  WHERE owner_id = p_user_id;

  IF v_existing_count > 0 THEN
    UPDATE public.profiles SET onboarded = true WHERE id = p_user_id;
    RETURN NULL;
  END IF;

  BEGIN
    v_first_name := NULLIF(TRIM(p_metadata->>'first_name'), '');

    IF v_first_name IS NOT NULL THEN
      v_workspace_name := v_first_name || '''s Workspace';
    ELSE
      v_workspace_name := 'My Workspace';
    END IF;

    v_trial_expires := date_trunc('month', p_now) + interval '1 month' - interval '1 second';

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
      p_user_id,
      'encrypted',
      true,
      'pro',
      3,
      'trialing',
      v_trial_expires,
      'app',
      p_now,
      p_now
    )
    RETURNING id INTO v_workspace_id;

    INSERT INTO public.workspace_members (
      workspace_id,
      user_id,
      role,
      joined_at
    ) VALUES (
      v_workspace_id,
      p_user_id,
      'owner',
      p_now
    );

    UPDATE public.profiles SET onboarded = true WHERE id = p_user_id;

    RETURN v_workspace_id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Workspace creation failed for user %: %', p_user_id, SQLERRM;
    RETURN NULL;
  END;
END;
$function$;
