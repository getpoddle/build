/*
  # Add Follow Notifications

  1. Changes
    - Update notifications table type constraint to include 'follow' type
    - Create trigger to automatically notify users when they are followed

  2. Functionality
    - When a user follows another user, the followed user receives a notification
    - Notification includes the follower's name and links to their profile
    - Uses the existing notifications system infrastructure

  3. Security
    - Uses existing RLS policies for notifications table
    - Only creates notifications for legitimate follow actions

  4. Performance
    - Leverages existing indexes on notifications table
*/

-- Update the type constraint to include 'follow'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('message', 'reaction', 'comment', 'pod_invite', 'follow'));

-- Update the related_type constraint to include 'profile'
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_type_check 
  CHECK (related_type IN ('message', 'insight', 'comment', 'conversation', 'profile'));

-- Function to create notification when someone follows a user
CREATE OR REPLACE FUNCTION notify_new_follower()
RETURNS TRIGGER AS $$
DECLARE
  follower_name text;
BEGIN
  -- Don't create notification if someone tries to follow themselves (shouldn't happen but safety check)
  IF NEW.follower_id = NEW.following_id THEN
    RETURN NEW;
  END IF;

  -- Get follower's name
  SELECT full_name INTO follower_name
  FROM profiles
  WHERE id = NEW.follower_id;

  -- Create notification for the user being followed
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    related_id,
    related_type,
    actor_id
  )
  VALUES (
    NEW.following_id,
    'follow',
    'New follower',
    follower_name || ' started following you',
    NEW.follower_id,
    'profile',
    NEW.follower_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new followers
DROP TRIGGER IF EXISTS trigger_notify_new_follower ON followers;
CREATE TRIGGER trigger_notify_new_follower
  AFTER INSERT ON followers
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_follower();