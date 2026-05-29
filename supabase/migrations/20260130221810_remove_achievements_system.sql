/*
  # Remove Achievements System

  This migration removes all achievements-related database objects from the system.

  ## Removed Tables
    - `user_achievements` - Tracks which achievements users have unlocked
    - `achievements` - Stores all available achievements

  ## Removed Functions
    - `check_and_unlock_achievements()` - Trigger function that checks if users qualify for new achievements

  ## Removed Triggers
    - Any triggers that call the achievement checking function

  ## Cleanup
    - Removes foreign key constraints
    - Drops indexes
    - Removes achievement notifications from the notifications table
*/

-- Drop the trigger function that checks for achievement unlocks
DROP FUNCTION IF EXISTS check_and_unlock_achievements() CASCADE;

-- Delete achievement-related notifications
DELETE FROM notifications WHERE type = 'achievement' OR related_type = 'achievement';

-- Drop the user_achievements table (this will cascade to remove foreign keys)
DROP TABLE IF EXISTS user_achievements CASCADE;

-- Drop the achievements table
DROP TABLE IF EXISTS achievements CASCADE;

-- Update the notifications table check constraint to remove achievement types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type = ANY (ARRAY['message'::text, 'reaction'::text, 'comment'::text, 'pod_invite'::text, 'follow'::text]));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_type_check 
  CHECK (related_type = ANY (ARRAY['message'::text, 'insight'::text, 'comment'::text, 'conversation'::text, 'profile'::text]));