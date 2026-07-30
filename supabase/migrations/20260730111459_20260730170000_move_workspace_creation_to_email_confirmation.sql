/*
# Move workspace creation from signup to email confirmation

## Summary
Previously, a workspace was auto-created at signup time (in the handle_new_user()
trigger on auth.users INSERT). This meant unconfirmed users got a workspace
before verifying their email. Now workspace creation fires ONLY when the user's
email is confirmed — i.e., on auth.users UPDATE where email_confirmed_at changes
from NULL to a timestamp.

## Changes

### 1. Modify handle_new_user() — remove workspace creation
The signup trigger now ONLY creates the profile row. No workspace, no
workspace_members, no seed messages. Unconfirmed users have no workspace.

### 2. Create handle_email_confirmed() — new trigger on auth.users UPDATE
Fires AFTER UPDATE on auth.users, but ONLY when:
  - OLD.email_confirmed_at IS NULL (was not confirmed before)
  - NEW.email_confirmed_at IS NOT NULL (is now confirmed)
This is the single point where workspace creation happens for new users.

The function:
  - Creates a workspace named "{first_name}'s Workspace" (fallback "My Workspace")
  - Adds the user as owner in workspace_members
  - Sets plan='pro', subscription_status='trialing', trial expires end of month
  - Runs as SECURITY DEFINER so it can insert into workspaces + workspace_members
  - Wrapped in BEGIN/EXCEPTION so a failure never blocks email confirmation

### 3. Create the trigger
  - Name: on_email_confirmed
  - Table: auth.users
  - Timing: AFTER UPDATE
  - Condition: OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL

## Security
- handle_email_confirmed() is SECURITY DEFINER, search_path = public
- It inserts into workspaces and workspace_members (which have RLS) — the
  SECURITY DEFINER context bypasses RLS for the trigger, same as handle_new_user
- No new RLS policies needed — the user accesses their workspace through
  existing authenticated policies after confirmation

## Important Notes
1. Existing users who already have workspaces are unaffected — the trigger
   only fires when email_confirmed_at transitions from NULL to non-NULL.
2. Users who signed up before this migration and are already confirmed won't
   re-trigger because OLD.email_confirmed_at is already non-NULL.
3. The handle_new_user() trigger still creates the profile row at signup —
   only the workspace creation portion was removed.
4. If workspace creation fails (e.g., constraint violation), the exception
   is caught and logged; email confirmation still succeeds. The user can
   create a workspace manually as a fallback.
*/

-- ── 1. Modify handle_new_user() — profile only, no workspace ──
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
BEGIN
  -- Create the profile row only. Workspace creation is deferred to
  -- email confirmation (see handle_email_confirmed).
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

  RETURN NEW;
END;
$$;

-- ── 2. Create handle_email_confirmed() — workspace creation on confirmation ──
CREATE OR REPLACE FUNCTION public.handle_email_confirmed()
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
  v_existing_count integer;
BEGIN
  -- Guard: only proceed if this is the null → non-null transition
  IF OLD.email_confirmed_at IS NOT NULL OR NEW.email_confirmed_at IS NULL THEN
    RETURN NEW;
  END IF;

  -- Guard: don't create a workspace if the user already has one
  -- (handles edge cases like re-confirmation or manual admin actions)
  SELECT count(*) INTO v_existing_count
  FROM public.workspaces
  WHERE owner_id = NEW.id;

  IF v_existing_count > 0 THEN
    -- Mark profile as onboarded since they already have a workspace
    UPDATE public.profiles SET onboarded = true WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  -- ── Create workspace (best-effort: never block confirmation) ──
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

    -- Mark profile as onboarded
    UPDATE public.profiles SET onboarded = true WHERE id = NEW.id;

  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Workspace creation failed on email confirmation for user %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- ── 3. Create the trigger on auth.users UPDATE ──
DROP TRIGGER IF EXISTS on_email_confirmed ON auth.users;
CREATE TRIGGER on_email_confirmed
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL)
  EXECUTE FUNCTION public.handle_email_confirmed();
