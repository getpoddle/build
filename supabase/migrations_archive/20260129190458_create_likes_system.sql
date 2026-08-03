/*
  # Create Likes System

  1. New Tables
    - `insight_likes`
      - `id` (uuid, primary key)
      - `insight_id` (uuid, foreign key to insights)
      - `user_id` (uuid, foreign key to profiles)
      - `created_at` (timestamptz)
      - Unique constraint on (insight_id, user_id) to prevent duplicate likes

  2. Changes
    - Add `like_count` column to `insights` table with default value 0
    - Create trigger to automatically update like_count when likes are added/removed

  3. Security
    - Enable RLS on `insight_likes` table
    - Add policy for authenticated users to view all likes
    - Add policy for authenticated users to create their own likes
    - Add policy for authenticated users to delete only their own likes

  4. Performance
    - Create index on `insight_likes(insight_id)` for fast like count queries
    - Create index on `insight_likes(user_id)` for checking user's liked insights
    - Create unique index on `insight_likes(insight_id, user_id)` for preventing duplicate likes
*/

-- Add like_count column to insights table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'insights' AND column_name = 'like_count'
  ) THEN
    ALTER TABLE insights ADD COLUMN like_count integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create insight_likes table
CREATE TABLE IF NOT EXISTS insight_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id uuid NOT NULL REFERENCES insights(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  CONSTRAINT unique_insight_like UNIQUE (insight_id, user_id)
);

-- Enable RLS
ALTER TABLE insight_likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insight_likes
CREATE POLICY "Anyone can view likes"
  ON insight_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create their own likes"
  ON insight_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON insight_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_insight_likes_insight_id ON insight_likes(insight_id);
CREATE INDEX IF NOT EXISTS idx_insight_likes_user_id ON insight_likes(user_id);

-- Function to update like count
CREATE OR REPLACE FUNCTION update_insight_like_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE insights
    SET like_count = like_count + 1
    WHERE id = NEW.insight_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE insights
    SET like_count = GREATEST(like_count - 1, 0)
    WHERE id = OLD.insight_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for like count updates
DROP TRIGGER IF EXISTS trigger_update_insight_like_count ON insight_likes;
CREATE TRIGGER trigger_update_insight_like_count
  AFTER INSERT OR DELETE ON insight_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_insight_like_count();

-- Initialize like_count for existing insights
UPDATE insights
SET like_count = (
  SELECT COUNT(*)
  FROM insight_likes
  WHERE insight_likes.insight_id = insights.id
)
WHERE like_count = 0;