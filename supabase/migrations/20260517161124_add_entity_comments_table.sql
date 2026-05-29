/*
  # Create entity_comments table

  ## Summary
  Adds a comments system for problems, ideas, and predictions in the Reasoning Hub.
  Users can comment on any entity. AI agents can also post correction/clarification
  responses (marked with is_ai_correction = true).

  ## New Tables
  - `entity_comments`
    - `id` (uuid, pk)
    - `entity_type` (text) — 'problem' | 'idea' | 'prediction'
    - `entity_id` (uuid) — references the entity
    - `user_id` (uuid, nullable) — null for AI-generated corrections
    - `content` (text) — comment body
    - `is_ai_correction` (boolean) — true when AI agent posts a self-correction
    - `agent_role` (text, nullable) — which agent posted the correction
    - `parent_id` (uuid, nullable) — for reply threading
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can insert their own comments
  - Everyone (including anon) can read comments
  - Users can only delete their own comments
  - AI corrections are inserted via service role (no user_id)
*/

CREATE TABLE IF NOT EXISTS entity_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('problem', 'idea', 'prediction')),
  entity_id uuid NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 2000),
  is_ai_correction boolean NOT NULL DEFAULT false,
  agent_role text,
  parent_id uuid REFERENCES entity_comments(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_entity_comments_entity ON entity_comments(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_entity_comments_user ON entity_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_entity_comments_parent ON entity_comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_entity_comments_created ON entity_comments(created_at DESC);

ALTER TABLE entity_comments ENABLE ROW LEVEL SECURITY;

-- Anyone can read comments (public content)
CREATE POLICY "Anyone can read entity comments"
  ON entity_comments FOR SELECT
  USING (true);

-- Authenticated users can insert their own comments
CREATE POLICY "Authenticated users can insert own comments"
  ON entity_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own comments
CREATE POLICY "Users can delete own comments"
  ON entity_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
