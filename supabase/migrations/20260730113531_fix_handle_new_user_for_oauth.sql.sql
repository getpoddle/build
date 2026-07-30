-- Fix: Google OAuth users have email_confirmed_at set at creation time,
-- so the on_email_confirmed trigger (null → non-null) never fires.
-- handle_new_user should create the workspace immediately if the user
-- is already confirmed at signup time.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Create the profile row.
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
    false,
    v_now,
    v_now
  )
  ON CONFLICT (id) DO NOTHING;

  -- If the user is already confirmed at creation time (Google OAuth),
  -- create the workspace now — the on_email_confirmed trigger won't fire.
  IF NEW.email_confirmed_at IS NOT NULL THEN
    PERFORM public.create_workspace_for_user(NEW.id, NEW.raw_user_meta_data, v_now);
  END IF;

  RETURN NEW;
END;
$function$;
