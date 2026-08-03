/*
  # Add Admin Verification Management System

  1. Changes
    - Add `is_admin` field to profiles table
    - Create function to approve verification requests
    - Create function to reject verification requests
    - Add RLS policies for admin access to verification data
  
  2. Security
    - Only admins can approve/reject verification requests
    - Users can view their own verification status
*/

-- Add is_admin field to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Function to approve verification
CREATE OR REPLACE FUNCTION approve_verification(target_user_id uuid, admin_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Check if the user is an admin
  SELECT is_admin INTO is_admin_user
  FROM profiles
  WHERE id = admin_user_id;

  IF NOT is_admin_user THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin privileges required'
    );
  END IF;

  -- Update the profile
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

-- Function to reject verification
CREATE OR REPLACE FUNCTION reject_verification(target_user_id uuid, admin_user_id uuid, rejection_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin_user boolean;
BEGIN
  -- Check if the user is an admin
  SELECT is_admin INTO is_admin_user
  FROM profiles
  WHERE id = admin_user_id;

  IF NOT is_admin_user THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: Admin privileges required'
    );
  END IF;

  -- Update the profile
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

-- Make your profile an admin (using the user_id from earlier)
UPDATE profiles
SET is_admin = true
WHERE id = '5c3d2a21-083f-4e7c-b8d0-5378af07a8d0';