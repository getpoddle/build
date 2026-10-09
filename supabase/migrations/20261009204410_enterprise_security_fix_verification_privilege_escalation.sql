/*
# Fix Privilege Escalation in approve_verification and reject_verification

## Summary
Both functions accepted `admin_user_id` as a client-supplied parameter, allowing
any authenticated user to pass an admin's UUID and bypass the admin check. The
functions now derive the caller's identity from `auth.uid()` instead.

## Changes
1. `approve_verification(target_user_id uuid)` — removed `admin_user_id` parameter,
   now uses `auth.uid()` to verify admin status.
2. `reject_verification(target_user_id uuid)` — same fix.
3. Both functions now RAISE EXCEPTION instead of returning jsonb on auth failure
   (consistent with other admin functions like ban_user_account).

## Security
- Fixes CRITICAL privilege escalation: any authenticated user could approve/reject
  verifications by passing an admin's UUID as `admin_user_id`.
- Caller identity is now derived from `auth.uid()` which cannot be forged.
*/

CREATE OR REPLACE FUNCTION approve_verification(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM admins WHERE id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
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

CREATE OR REPLACE FUNCTION reject_verification(target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin_id uuid;
BEGIN
  v_admin_id := auth.uid();

  IF v_admin_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM admins WHERE id = v_admin_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: Admin privileges required';
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

-- Revoke from anon, grant to authenticated (standard pattern)
REVOKE EXECUTE ON FUNCTION approve_verification(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION approve_verification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION approve_verification(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION reject_verification(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION reject_verification(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reject_verification(uuid) TO authenticated;
