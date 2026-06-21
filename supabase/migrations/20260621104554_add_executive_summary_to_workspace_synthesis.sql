ALTER TABLE workspace_synthesis
  ADD COLUMN IF NOT EXISTS executive_summary text,
  ADD COLUMN IF NOT EXISTS key_decisions jsonb DEFAULT '[]'::jsonb;
