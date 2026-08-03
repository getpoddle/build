/*
  # User Blocking System

  1. New Tables
    - `user_blocks`
      - `id` (uuid, primary key)
      - `blocker_id` (uuid, references profiles) - User who blocked
      - `blocked_id` (uuid, references profiles) - User who is blocked
      - `created_at` (timestamptz)
      - Composite unique constraint on (blocker_id, blocked_id)

  2. Security
    - Enable RLS on `user_blocks` table
    - Users can only create blocks for themselves
    - Users can only view their own blocks
    - Users can only delete their own blocks

  3. Indexes
    - Index on blocker_id for fast lookup of who a user has blocked
    - Index on blocked_id for fast lookup of who has blocked a user
*/

CREATE TABLE IF NOT EXISTS user_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

ALTER TABLE user_blocks ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker ON user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id);

CREATE POLICY "Users can create own blocks"
  ON user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can view own blocks"
  ON user_blocks FOR SELECT
  TO authenticated
  USING (auth.uid() = blocker_id);

CREATE POLICY "Users can delete own blocks"
  ON user_blocks FOR DELETE
  TO authenticated
  USING (auth.uid() = blocker_id);