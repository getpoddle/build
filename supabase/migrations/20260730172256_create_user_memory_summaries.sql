-- Cross-workspace memory: compact summaries of a user's prior workspaces
-- that get injected into the system prompt of new workspaces so AI agents
-- can recall context from previous decisions.

CREATE TABLE IF NOT EXISTS user_memory_summaries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  summary_text text NOT NULL,
  key_decisions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast "most recent N summaries for this user" lookups
CREATE INDEX IF NOT EXISTS idx_user_memory_summaries_user_created
  ON user_memory_summaries (user_id, created_at DESC);

-- RLS: users can only read their own memory summaries
ALTER TABLE user_memory_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "select_own_memory_summaries" ON user_memory_summaries
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_memory_summaries" ON user_memory_summaries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_memory_summaries" ON user_memory_summaries
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_memory_summaries" ON user_memory_summaries
  FOR DELETE TO authenticated USING (auth.uid() = user_id);