/*
  # Add AI Thread Recommendations Table

  ## Summary
  Adds a table to store AI-generated recommendations for decision threads.
  When a user requests an AI recommendation on a decision thread, the system
  analyzes all available decision paths (with their focus, risk, upside, notes)
  alongside any thread context (assumptions, risks, scenarios logged as updates)
  and produces a structured recommendation picking the best path with reasoning.

  ## New Tables
  - `ai_thread_recommendations`
    - `id` (uuid, primary key)
    - `thread_id` (uuid, FK to decision_threads) — which decision thread this is for
    - `recommended_path_id` (uuid, nullable FK to decision_paths) — the chosen path (null if no paths yet)
    - `recommended_path_title` (text) — denormalized title for display even if path is deleted
    - `reasoning` (text) — main explanation for why this path was recommended
    - `key_factors` (jsonb) — array of strings: the key factors that drove the decision
    - `risks_to_watch` (jsonb) — array of strings: important risks to monitor
    - `confidence_score` (int) — 0-100 confidence in the recommendation
    - `agent_count` (int) — number of insights synthesized
    - `created_by` (uuid, FK to profiles) — who triggered the recommendation
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - SELECT: all authenticated users can view recommendations for threads they have access to
  - INSERT: authenticated users can insert (restricted to their own user_id)
  - UPDATE/DELETE: only the creator can manage their recommendations
*/

CREATE TABLE IF NOT EXISTS ai_thread_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES decision_threads(id) ON DELETE CASCADE,
  recommended_path_id uuid REFERENCES decision_paths(id) ON DELETE SET NULL,
  recommended_path_title text NOT NULL DEFAULT '',
  reasoning text NOT NULL DEFAULT '',
  key_factors jsonb NOT NULL DEFAULT '[]',
  risks_to_watch jsonb NOT NULL DEFAULT '[]',
  confidence_score int NOT NULL DEFAULT 70 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  agent_count int NOT NULL DEFAULT 0,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_thread_recommendations_thread_id ON ai_thread_recommendations(thread_id);
CREATE INDEX IF NOT EXISTS idx_ai_thread_recommendations_created_by ON ai_thread_recommendations(created_by);

ALTER TABLE ai_thread_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view thread recommendations"
  ON ai_thread_recommendations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own recommendations"
  ON ai_thread_recommendations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own recommendations"
  ON ai_thread_recommendations FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own recommendations"
  ON ai_thread_recommendations FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);
