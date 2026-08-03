/*
  # Add AI Challenge Replies

  ## Summary
  Adds support for AI agents to reply to human challenges in the assumption challenges section.

  ## Changes

  ### New Table
  - `challenge_ai_replies` — stores AI agent replies to human challenge entries
    - `id` (uuid, PK)
    - `challenge_id` (uuid, FK → assumption_challenges.id, CASCADE DELETE)
    - `assumption_id` (uuid, FK → pod_assumptions.id, CASCADE DELETE)
    - `agent_name` (text) — which AI agent responded (e.g. "The Skeptic")
    - `agent_role` (text) — agent role description
    - `display_name` (text) — culturally localised first name
    - `content` (text) — the AI reply content
    - `confidence_score` (int) — 0-100
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled, authenticated users can read all replies
  - Service role can insert (edge function runs as service role)
*/

CREATE TABLE IF NOT EXISTS challenge_ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES assumption_challenges(id) ON DELETE CASCADE,
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  agent_role text NOT NULL DEFAULT '',
  display_name text,
  content text NOT NULL,
  confidence_score integer NOT NULL DEFAULT 75 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_challenge_ai_replies_challenge_id ON challenge_ai_replies(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_ai_replies_assumption_id ON challenge_ai_replies(assumption_id);

ALTER TABLE challenge_ai_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read challenge AI replies"
  ON challenge_ai_replies FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can insert challenge AI replies"
  ON challenge_ai_replies FOR INSERT
  TO service_role
  WITH CHECK (true);
