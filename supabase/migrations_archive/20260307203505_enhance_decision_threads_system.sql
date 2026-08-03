/*
  # Enhance Decision Threads System

  1. Updates to Existing Tables
    - Add missing columns to decision_threads
    - Create new supporting tables
    - Add proper indexes and constraints

  2. New Tables
    - `decision_thread_votes` - Track member votes
    - `decision_thread_tags` - Tag relevant members
    - `decision_thread_links` - Link related decisions

  3. Security
    - Update RLS policies
    - Ensure proper access control
*/

-- Add missing columns to decision_threads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decision_threads' AND column_name = 'decision_deadline') THEN
    ALTER TABLE decision_threads ADD COLUMN decision_deadline timestamptz;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decision_threads' AND column_name = 'dissent_count') THEN
    ALTER TABLE decision_threads ADD COLUMN dissent_count integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decision_threads' AND column_name = 'success_criteria') THEN
    ALTER TABLE decision_threads ADD COLUMN success_criteria text;
  END IF;
END $$;

-- Create decision_thread_votes table
CREATE TABLE IF NOT EXISTS decision_thread_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES decision_threads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  vote text NOT NULL CHECK (vote IN ('agree', 'disagree', 'abstain')),
  reasoning text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Create decision_thread_tags table
CREATE TABLE IF NOT EXISTS decision_thread_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES decision_threads(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, user_id)
);

-- Create decision_thread_links table
CREATE TABLE IF NOT EXISTS decision_thread_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES decision_threads(id) ON DELETE CASCADE NOT NULL,
  linked_thread_id uuid REFERENCES decision_threads(id) ON DELETE CASCADE NOT NULL,
  relationship text NOT NULL CHECK (relationship IN ('builds_on', 'similar_to', 'reverses', 'references')),
  created_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, linked_thread_id)
);

-- Update decision_thread_updates check constraint if needed
DO $$
BEGIN
  ALTER TABLE decision_thread_updates DROP CONSTRAINT IF EXISTS decision_thread_updates_update_type_check;
  ALTER TABLE decision_thread_updates ADD CONSTRAINT decision_thread_updates_update_type_check 
    CHECK (update_type IN ('assumption_added', 'risk_added', 'scenario_added', 'forecast_added', 'stage_changed', 'decision_made', 'learning_update', 'comment'));
END $$;

-- Add reference_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'decision_thread_updates' AND column_name = 'reference_id') THEN
    ALTER TABLE decision_thread_updates ADD COLUMN reference_id uuid;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_decision_thread_votes_thread_id ON decision_thread_votes(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_votes_user_id ON decision_thread_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_tags_thread_id ON decision_thread_tags(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_tags_user_id ON decision_thread_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_links_thread_id ON decision_thread_links(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_links_linked_thread_id ON decision_thread_links(linked_thread_id);

-- Enable RLS
ALTER TABLE decision_thread_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_thread_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_thread_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for decision_thread_votes
DROP POLICY IF EXISTS "Pod members can view votes" ON decision_thread_votes;
CREATE POLICY "Pod members can view votes"
  ON decision_thread_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_votes.thread_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pod members can vote" ON decision_thread_votes;
CREATE POLICY "Pod members can vote"
  ON decision_thread_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_votes.thread_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update their own votes" ON decision_thread_votes;
CREATE POLICY "Users can update their own votes"
  ON decision_thread_votes FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for decision_thread_tags
DROP POLICY IF EXISTS "Pod members can view tags" ON decision_thread_tags;
CREATE POLICY "Pod members can view tags"
  ON decision_thread_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_tags.thread_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pod members can create tags" ON decision_thread_tags;
CREATE POLICY "Pod members can create tags"
  ON decision_thread_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_tags.thread_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete tags they created" ON decision_thread_tags;
CREATE POLICY "Thread creator can delete tags"
  ON decision_thread_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      WHERE dt.id = decision_thread_tags.thread_id
      AND dt.created_by = auth.uid()
    )
  );

-- RLS Policies for decision_thread_links
DROP POLICY IF EXISTS "Pod members can view links" ON decision_thread_links;
CREATE POLICY "Pod members can view links"
  ON decision_thread_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_links.thread_id
      AND pm.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Pod members can create links" ON decision_thread_links;
CREATE POLICY "Pod members can create links"
  ON decision_thread_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_links.thread_id
      AND pm.user_id = auth.uid()
    )
  );

-- Function to update dissent count
CREATE OR REPLACE FUNCTION update_decision_dissent_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE decision_threads
  SET dissent_count = (
    SELECT COUNT(*)
    FROM decision_thread_votes
    WHERE thread_id = COALESCE(NEW.thread_id, OLD.thread_id)
    AND vote = 'disagree'
  )
  WHERE id = COALESCE(NEW.thread_id, OLD.thread_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update dissent count
DROP TRIGGER IF EXISTS update_dissent_count_trigger ON decision_thread_votes;
CREATE TRIGGER update_dissent_count_trigger
  AFTER INSERT OR UPDATE OR DELETE ON decision_thread_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_decision_dissent_count();