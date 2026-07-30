-- ============================================================
-- REVERT: Simplify handle_email_confirmed to only mark onboarded
-- ============================================================
-- The recent changes made handle_email_confirmed auto-create a
-- workspace on email confirmation. Revert: it should only mark
-- the profile as onboarded=true. The user creates a workspace
-- manually via the Workspaces page.

CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed on the null → non-null transition
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Mark the profile as onboarded. No workspace creation.
  UPDATE public.profiles SET onboarded = true WHERE id = NEW.id;

  RETURN NEW;
END;
$$;
