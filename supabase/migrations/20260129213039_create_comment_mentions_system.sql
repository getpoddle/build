/*
  # Create Comment Mentions System

  1. New Tables
    - `comment_mentions`
      - `id` (uuid, primary key)
      - `comment_id` (uuid, references comments)
      - `mentioned_user_id` (uuid, references profiles)
      - `mentioned_by_user_id` (uuid, references profiles)
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on `comment_mentions` table
    - Add policy for users to read mentions where they are involved
    - Add policy for authenticated users to create mentions
  
  3. Triggers
    - Add trigger to create notifications when users are mentioned
  
  4. Changes
    - Update notifications table to support mention type
*/

-- Create comment_mentions table
CREATE TABLE IF NOT EXISTS comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentioned_by_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(comment_id, mentioned_user_id)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_user ON comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_comment ON comment_mentions(comment_id);

-- Enable RLS
ALTER TABLE comment_mentions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view mentions they are involved in"
  ON comment_mentions FOR SELECT
  TO authenticated
  USING (
    auth.uid() = mentioned_user_id OR 
    auth.uid() = mentioned_by_user_id
  );

CREATE POLICY "Authenticated users can create mentions"
  ON comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = mentioned_by_user_id);

CREATE POLICY "Users can delete their own mentions"
  ON comment_mentions FOR DELETE
  TO authenticated
  USING (auth.uid() = mentioned_by_user_id);

-- Function to create mention notification
CREATE OR REPLACE FUNCTION create_mention_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Don't notify if user mentions themselves
  IF NEW.mentioned_user_id != NEW.mentioned_by_user_id THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      message,
      link,
      actor_id
    )
    SELECT
      NEW.mentioned_user_id,
      'mention',
      'mentioned you in a comment',
      SUBSTRING(c.content, 1, 100),
      '/pods/' || i.pod_id,
      NEW.mentioned_by_user_id
    FROM comments c
    JOIN insights i ON c.insight_id = i.id
    WHERE c.id = NEW.comment_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when user is mentioned
DROP TRIGGER IF EXISTS trigger_mention_notification ON comment_mentions;
CREATE TRIGGER trigger_mention_notification
  AFTER INSERT ON comment_mentions
  FOR EACH ROW
  EXECUTE FUNCTION create_mention_notification();
