/*
  # Add Delete User Function
  
  1. Purpose
    - Allow admins to completely delete a user and all their data from the system
    - Ensures cascading deletion of all user-related content
  
  2. Function: delete_user_account
    - Deletes user from auth.users (which cascades to profiles via trigger)
    - Manually deletes all user contributions and activity
    - Only callable by admins
  
  3. Security
    - Function uses SECURITY DEFINER to allow deletion of auth.users
    - Only admins can call this function (checked via RLS on profiles table)
    - Prevents users from deleting themselves or other users
*/

-- Create function to delete a user and all their data
CREATE OR REPLACE FUNCTION delete_user_account(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  admin_check boolean;
BEGIN
  -- Verify caller is an admin
  SELECT EXISTS (
    SELECT 1 FROM admins WHERE id = auth.uid()
  ) INTO admin_check;
  
  IF NOT admin_check THEN
    RAISE EXCEPTION 'Only admins can delete user accounts';
  END IF;

  -- Delete user's contributions (cascading will handle most foreign keys)
  -- But we'll be explicit for critical tables
  DELETE FROM pod_assumptions WHERE created_by = target_user_id;
  DELETE FROM assumption_forecasts WHERE created_by = target_user_id;
  DELETE FROM assumption_risks WHERE created_by = target_user_id;
  DELETE FROM assumption_scenarios WHERE created_by = target_user_id;
  DELETE FROM challenges WHERE created_by = target_user_id;
  DELETE FROM challenge_responses WHERE created_by = target_user_id;
  DELETE FROM decision_thread_responses WHERE created_by = target_user_id;
  DELETE FROM decision_threads WHERE created_by = target_user_id;
  DELETE FROM posts WHERE created_by = target_user_id;
  DELETE FROM comments WHERE created_by = target_user_id;
  DELETE FROM messages WHERE sender_id = target_user_id OR receiver_id = target_user_id;
  DELETE FROM conversations WHERE user1_id = target_user_id OR user2_id = target_user_id;
  DELETE FROM notifications WHERE user_id = target_user_id OR actor_id = target_user_id;
  DELETE FROM likes WHERE user_id = target_user_id;
  DELETE FROM followers WHERE follower_id = target_user_id OR following_id = target_user_id;
  DELETE FROM pod_members WHERE user_id = target_user_id;
  DELETE FROM marketplace_listings WHERE seller_id = target_user_id;
  DELETE FROM invite_codes WHERE created_by = target_user_id OR used_by = target_user_id;
  DELETE FROM user_blocks WHERE blocker_id = target_user_id OR blocked_id = target_user_id;
  DELETE FROM account_status WHERE user_id = target_user_id;
  DELETE FROM moderation_actions WHERE target_user_id = target_user_id OR moderator_id = target_user_id;
  
  -- Delete profile (this should cascade to other tables with ON DELETE CASCADE)
  DELETE FROM profiles WHERE id = target_user_id;
  
  -- Finally delete from auth.users (this is the critical step)
  DELETE FROM auth.users WHERE id = target_user_id;
  
END;
$$;

-- Grant execute permission to authenticated users (function itself checks for admin)
GRANT EXECUTE ON FUNCTION delete_user_account(uuid) TO authenticated;
