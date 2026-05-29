/*
  # Create workspace messages table for AI collaboration

  1. New Tables
    - `workspace_messages`
      - `id` (uuid, primary key)
      - `workspace_id` (uuid, FK → workspaces)
      - `user_id` (uuid, FK → profiles, nullable for AI messages)
      - `role` (text): 'user' | 'assistant'
      - `content` (text): message body
      - `agent_name` (text, nullable): e.g. "Strategic Analyst"
      - `agent_role` (text, nullable): e.g. "devil_advocate"
      - `metadata` (jsonb, nullable): extra structured data
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled; workspace members can read/write messages in their workspace
*/

CREATE TABLE IF NOT EXISTS workspace_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  role          text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant')),
  content       text NOT NULL,
  agent_name    text,
  agent_role    text,
  metadata      jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_messages_workspace_id ON workspace_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_messages_created_at  ON workspace_messages(workspace_id, created_at);

ALTER TABLE workspace_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read messages"
  ON workspace_messages FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can insert messages"
  ON workspace_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid());

CREATE POLICY "Users can delete their own messages"
  ON workspace_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());
