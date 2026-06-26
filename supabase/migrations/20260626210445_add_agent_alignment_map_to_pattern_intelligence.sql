ALTER TABLE user_pattern_intelligence
  ADD COLUMN IF NOT EXISTS agent_alignment_map jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS avg_alignment_score integer DEFAULT NULL;
