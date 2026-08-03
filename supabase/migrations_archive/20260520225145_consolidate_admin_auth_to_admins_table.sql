/*
  # Consolidate admin verification to single admins table

  ## Problem
  Two separate admin mechanisms existed:
  - `admin_email_list` — checked by Admin.tsx (email string, stale-prone)
  - `admins` — checked by AdminPanel.tsx (UUID-based, correct)
  - `approve_verification` / `reject_verification` RPCs — checked `profiles.is_admin` (third mechanism)

  All three were unsynchronized, allowing privilege escalation via stale email entries.

  ## Changes
  1. Fix `approve_verification` to check `admins` table by UUID
  2. Fix `reject_verification` to check `admins` table by UUID
  3. `Admin.tsx` will be updated in frontend to also use `admins` table by UUID

  The `admin_email_list` table is left intact (not dropped) to avoid data loss,
  but it is no longer used for access control.
*/

-- Fix approve_verification: check admins table by UUID instead of profiles.is_admin
CREATE OR REPLACE FUNCTION approve_verification(
  target_user_id uuid,
  admin_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  -- Check caller is in the admins table by UUID
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE id = admin_user_id
  ) INTO admin_exists;

  IF NOT admin_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin privileges required'
    );
  END IF;

  UPDATE profiles
  SET
    verified = true,
    verification_requested_at = NULL
  WHERE id = target_user_id
    AND verification_requested_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending verification request found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification approved'
  );
END;
$$;

-- Fix reject_verification: check admins table by UUID instead of profiles.is_admin
CREATE OR REPLACE FUNCTION reject_verification(
  target_user_id uuid,
  admin_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_exists boolean;
BEGIN
  -- Check caller is in the admins table by UUID
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE id = admin_user_id
  ) INTO admin_exists;

  IF NOT admin_exists THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin privileges required'
    );
  END IF;

  UPDATE profiles
  SET
    verified = false,
    verification_requested_at = NULL
  WHERE id = target_user_id
    AND verification_requested_at IS NOT NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No pending verification request found'
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Verification rejected'
  );
END;
$$;
