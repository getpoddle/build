-- Refactor handle_email_confirmed to use the shared create_workspace_for_user helper.

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Guard: only proceed if this is the null → non-null transition
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Create workspace via shared helper (also marks profile as onboarded).
  PERFORM public.create_workspace_for_user(NEW.id, NEW.raw_user_meta_data, now());

  RETURN NEW;
END;
$function$;
