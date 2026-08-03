/*
  # Extend Learning System Tables for AI Features

  1. Modifications to Existing Tables
    - user_interests: Add weight column for relevance scoring
    - user_skills: Add category, proficiency_level, target_level, updated_at columns

  2. New Tables
    - learning_paths: AI-generated study paths
    - learning_path_steps: Individual steps in learning paths
    - skill_progress: Progress tracking for skills
    - ai_interactions: AI tutor conversation logs
    - content_recommendations: Personalized content suggestions

  3. Security
    - Maintain RLS on all tables
    - Users can only access their own learning data

  4. Indexes
    - Optimized for user lookups and filtering
*/

-- Extend user_interests table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interests' AND column_name = 'weight'
  ) THEN
    ALTER TABLE user_interests ADD COLUMN weight numeric DEFAULT 1.0 CHECK (weight >= 0 AND weight <= 1);
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_interests' AND column_name = 'interest_name'
  ) THEN
    ALTER TABLE user_interests RENAME COLUMN interest_name TO interest;
  END IF;
END $$;

-- Extend user_skills table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_skills' AND column_name = 'category'
  ) THEN
    ALTER TABLE user_skills ADD COLUMN category text DEFAULT '';
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_skills' AND column_name = 'proficiency_level'
  ) THEN
    ALTER TABLE user_skills ADD COLUMN proficiency_level integer DEFAULT 0 CHECK (proficiency_level >= 0 AND proficiency_level <= 100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_skills' AND column_name = 'target_level'
  ) THEN
    ALTER TABLE user_skills ADD COLUMN target_level integer DEFAULT 100 CHECK (target_level >= 0 AND target_level <= 100);
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_skills' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE user_skills ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Create indexes for user_interests if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_interests_interest ON user_interests(interest);

-- Create indexes for user_skills if they don't exist
CREATE INDEX IF NOT EXISTS idx_user_skills_category ON user_skills(category);

-- Learning Paths Table
CREATE TABLE IF NOT EXISTS learning_paths (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  skill_id uuid REFERENCES user_skills(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text DEFAULT '',
  generated_by_ai boolean DEFAULT false,
  status text DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused')),
  estimated_hours integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_paths_user_id ON learning_paths(user_id);
CREATE INDEX IF NOT EXISTS idx_learning_paths_status ON learning_paths(status);
CREATE INDEX IF NOT EXISTS idx_learning_paths_skill_id ON learning_paths(skill_id);

ALTER TABLE learning_paths ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own learning paths"
  ON learning_paths FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own learning paths"
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

-- Learning Path Steps Table
CREATE TABLE IF NOT EXISTS learning_path_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  learning_path_id uuid REFERENCES learning_paths(id) ON DELETE CASCADE NOT NULL,
  step_number integer NOT NULL,
  title text NOT NULL,
  description text DEFAULT '',
  resources jsonb DEFAULT '[]'::jsonb,
  estimated_hours numeric DEFAULT 0,
  completed boolean DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_learning_path_steps_path_id ON learning_path_steps(learning_path_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_steps_step_number ON learning_path_steps(learning_path_id, step_number);

ALTER TABLE learning_path_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view steps of own learning paths"
  ON learning_path_steps FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert steps to own learning paths"
  ON learning_path_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update steps of own learning paths"
  ON learning_path_steps FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete steps of own learning paths"
  ON learning_path_steps FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM learning_paths
      WHERE learning_paths.id = learning_path_steps.learning_path_id
      AND learning_paths.user_id = auth.uid()
    )
  );

-- Skill Progress Table
CREATE TABLE IF NOT EXISTS skill_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  skill_id uuid REFERENCES user_skills(id) ON DELETE CASCADE NOT NULL,
  activity_type text NOT NULL,
  activity_id uuid,
  points_earned integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_skill_progress_user_id ON skill_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_skill_progress_skill_id ON skill_progress(skill_id);

ALTER TABLE skill_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own skill progress"
  ON skill_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own skill progress"
  ON skill_progress FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- AI Interactions Table
CREATE TABLE IF NOT EXISTS ai_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  interaction_type text NOT NULL CHECK (interaction_type IN ('tutor', 'summary', 'recommendation', 'path_generation')),
  context_id uuid,
  user_message text DEFAULT '',
  ai_response text DEFAULT '',
  tokens_used integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_interactions_user_id ON ai_interactions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_type ON ai_interactions(interaction_type);
CREATE INDEX IF NOT EXISTS idx_ai_interactions_context ON ai_interactions(context_id);

ALTER TABLE ai_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own AI interactions"
  ON ai_interactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI interactions"
  ON ai_interactions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Content Recommendations Table
CREATE TABLE IF NOT EXISTS content_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('post', 'pod', 'marketplace_item', 'job')),
  content_id uuid NOT NULL,
  relevance_score numeric DEFAULT 0.5 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  reasons jsonb DEFAULT '[]'::jsonb,
  shown boolean DEFAULT false,
  clicked boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_recommendations_user_id ON content_recommendations(user_id);
CREATE INDEX IF NOT EXISTS idx_content_recommendations_content ON content_recommendations(content_type, content_id);
CREATE INDEX IF NOT EXISTS idx_content_recommendations_shown ON content_recommendations(user_id, shown);

ALTER TABLE content_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own recommendations"
  ON content_recommendations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own recommendations"
  ON content_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own recommendations"
  ON content_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);