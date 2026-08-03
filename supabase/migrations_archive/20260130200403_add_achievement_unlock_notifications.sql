/*
  # Add Achievement Unlock Notifications

  1. Changes
    - Update notification type constraint to include 'achievement'
    - Create trigger to send notification when achievement is unlocked
    
  2. Functionality
    - When a user unlocks an achievement, a notification is created
    - The notification includes the achievement details
*/

-- Update the check constraint on notifications type to include achievement
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_type_check' 
    AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_type_check;
  END IF;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY['message'::text, 'reaction'::text, 'comment'::text, 'pod_invite'::text, 'follow'::text, 'achievement'::text]));

-- Update the check constraint on notifications related_type to include achievement
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'notifications_related_type_check' 
    AND table_name = 'notifications'
  ) THEN
    ALTER TABLE notifications DROP CONSTRAINT notifications_related_type_check;
  END IF;
END $$;

ALTER TABLE notifications ADD CONSTRAINT notifications_related_type_check
  CHECK (related_type = ANY (ARRAY['message'::text, 'insight'::text, 'comment'::text, 'conversation'::text, 'profile'::text, 'achievement'::text]));

-- Function to create notification when achievement is unlocked
CREATE OR REPLACE FUNCTION notify_achievement_unlock()
RETURNS TRIGGER AS $$
DECLARE
  achievement_name text;
  achievement_description text;
BEGIN
  -- Get achievement details
  SELECT name, description INTO achievement_name, achievement_description
  FROM achievements
  WHERE id = NEW.achievement_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    content,
    related_id,
    related_type,
    is_read
  ) VALUES (
    NEW.user_id,
    'achievement',
    'Achievement Unlocked!',
    'You unlocked: ' || achievement_name || ' - ' || achievement_description,
    NEW.achievement_id,
    'achievement',
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for achievement notifications
DROP TRIGGER IF EXISTS trigger_notify_achievement_unlock ON user_achievements;
CREATE TRIGGER trigger_notify_achievement_unlock
  AFTER INSERT ON user_achievements
  FOR EACH ROW
  EXECUTE FUNCTION notify_achievement_unlock();
