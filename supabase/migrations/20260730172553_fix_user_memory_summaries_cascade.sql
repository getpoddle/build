-- Fix: user_memory_summaries.source_workspace_id should SET NULL when a
-- workspace is deleted, not CASCADE — otherwise the memory summary (which
-- is the whole point of generating it on workspace close) gets deleted too.

ALTER TABLE user_memory_summaries
  DROP CONSTRAINT IF EXISTS user_memory_summaries_source_workspace_id_fkey;

ALTER TABLE user_memory_summaries
  ALTER COLUMN source_workspace_id DROP NOT NULL;

ALTER TABLE user_memory_summaries
  ADD CONSTRAINT user_memory_summaries_source_workspace_id_fkey
  FOREIGN KEY (source_workspace_id) REFERENCES workspaces(id) ON DELETE SET NULL;