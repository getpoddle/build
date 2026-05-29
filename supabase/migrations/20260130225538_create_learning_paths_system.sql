/*
  # Create Learning Paths System with AI Integration

  1. New Tables
    - `learning_paths`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `title` (text)
      - `description` (text)
      - `goal` (text) - user's learning goal
      - `skill_level` (text) - beginner, intermediate, advanced
      - `estimated_duration` (text)
      - `generated_by_ai` (boolean)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

    - `learning_path_items`
      - `id` (uuid, primary key)
      - `learning_path_id` (uuid, foreign key)
      - `order_index` (integer)
      - `title` (text)
      - `description` (text)
      - `content` (text)
      - `resource_url` (text, nullable)
      - `estimated_time` (text)
      - `item_type` (text) - lesson, exercise, project, reading
      - `created_at` (timestamptz)

    - `learning_path_progress`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key)
      - `learning_path_item_id` (uuid, foreign key)
      - `completed` (boolean)
      - `notes` (text, nullable)
      - `completed_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can create and view their own learning paths
    - Users can only see their own progress
    - Learning path items are visible to path owners
*/

CREATE TABLE IF NOT EXISTS learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  goal text NOT NULL,
  skill_level text NOT NULL DEFAULT 'beginner',
  estimated_duration text,
  generated_by_ai boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_path_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id uuid NOT NULL REFERENCES learning_paths(id) ON DELETE CASCADE,
  order_index integer NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  content text NOT NULL,
  resource_url text,
  estimated_time text,
  item_type text NOT NULL DEFAULT 'lesson',
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS learning_path_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  learning_path_item_id uuid NOT NULL REFERENCES learning_path_items(id) ON DELETE CASCADE,
  completed boolean DEFAULT false,
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, learning_path_item_id)
);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_path_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning paths"
  ON learning_paths FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own learning paths"
  ON learning_paths FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own learning paths"
  ON learning_paths FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own learning paths"
  ON learning_paths FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view items from own learning paths"
  ON learning_path_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create items in own learning paths"
  ON learning_path_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update items in own learning paths"
  ON learning_path_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete items in own learning paths"
  ON learning_path_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_items.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view own progress"
  ON learning_path_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own progress"
  ON learning_path_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own progress"
  ON learning_path_progress FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own progress"
  ON learning_path_progress FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_items_path_id ON learning_path_items(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_items_order ON learning_path_items(learning_path_id, order_index);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_user_id ON learning_path_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_item_id ON learning_path_progress(learning_path_item_id);
