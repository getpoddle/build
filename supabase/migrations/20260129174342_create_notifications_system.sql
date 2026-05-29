/*
  # Create Notifications System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - The user receiving the notification
      - `type` (text) - Type of notification: 'message', 'reaction', 'comment', 'pod_invite'
      - `title` (text) - Notification title
      - `content` (text) - Notification content/message
      - `related_id` (uuid) - ID of related entity (message_id, insight_id, etc.)
      - `related_type` (text) - Type of related entity: 'message', 'insight', 'comment'
      - `actor_id` (uuid, references profiles) - User who triggered the notification
      - `is_read` (boolean) - Whether notification has been read
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on `notifications` table
    - Add policies for users to read their own notifications
    - Add policies for users to update their own notifications
    - Add policies for users to delete their own notifications

  3. Triggers
    - Auto-create notification when new message is received
    - Auto-create notification when insight receives a reaction
    - Auto-create notification when insight receives a comment

  4. Indexes
    - Index on user_id and is_read for fast unread count queries
    - Index on created_at for sorting
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type text NOT NULL CHECK (type IN ('message', 'reaction', 'comment', 'pod_invite')),
  title text NOT NULL,
  content text NOT NULL,
  related_id uuid,
  related_type text CHECK (related_type IN ('message', 'insight', 'comment', 'conversation')),
  actor_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  is_read boolean DEFAULT false NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own notifications
CREATE POLICY "Users can delete own notifications"
  ON notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);

-- Function to create notification for new messages
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  recipient_id uuid;
  sender_name text;
BEGIN
  -- Get the other participant in the conversation
  SELECT CASE 
    WHEN user_one_id = NEW.sender_id THEN user_two_id
    ELSE user_one_id
  END INTO recipient_id
  FROM conversations
  WHERE id = NEW.conversation_id;

  -- Get sender's name
  SELECT full_name INTO sender_name
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create notification for recipient
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
    recipient_id,
    'message',
    'New message',
    sender_name || ' sent you a message',
    NEW.conversation_id,
    'conversation',
    NEW.sender_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new messages
DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

-- Function to create notification for insight reactions
CREATE OR REPLACE FUNCTION notify_insight_reaction()
RETURNS TRIGGER AS $$
DECLARE
  insight_author_id uuid;
  reactor_name text;
BEGIN
  -- Get insight author
  SELECT author_id INTO insight_author_id
  FROM insights
  WHERE id = NEW.insight_id;

  -- Don't notify if user reacted to their own insight
  IF insight_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get reactor's name
  SELECT full_name INTO reactor_name
  FROM profiles
  WHERE id = NEW.user_id;

  -- Create notification
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
    insight_author_id,
    'reaction',
    'New reaction',
    reactor_name || ' reacted to your insight',
    NEW.insight_id,
    'insight',
    NEW.user_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for insight reactions
DROP TRIGGER IF EXISTS trigger_notify_insight_reaction ON reactions;
CREATE TRIGGER trigger_notify_insight_reaction
  AFTER INSERT ON reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_insight_reaction();

-- Function to create notification for insight comments
CREATE OR REPLACE FUNCTION notify_insight_comment()
RETURNS TRIGGER AS $$
DECLARE
  insight_author_id uuid;
  commenter_name text;
BEGIN
  -- Get insight author
  SELECT author_id INTO insight_author_id
  FROM insights
  WHERE id = NEW.insight_id;

  -- Don't notify if user commented on their own insight
  IF insight_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  -- Get commenter's name
  SELECT full_name INTO commenter_name
  FROM profiles
  WHERE id = NEW.author_id;

  -- Create notification
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
    insight_author_id,
    'comment',
    'New comment',
    commenter_name || ' commented on your insight',
    NEW.insight_id,
    'insight',
    NEW.author_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for insight comments
DROP TRIGGER IF EXISTS trigger_notify_insight_comment ON comments;
CREATE TRIGGER trigger_notify_insight_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_insight_comment();