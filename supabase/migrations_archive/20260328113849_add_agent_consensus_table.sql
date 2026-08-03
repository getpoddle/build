/*
  # Add Agent Consensus Table

  ## Summary
  Adds a table to store AI-generated consensus summaries for assumptions.

  ## New Tables
  - `agent_consensus`
    - `id` (uuid, primary key)
    - `assumption_id` (uuid, FK to pod_assumptions)
    - `verdict` (text) - overall verdict: 'likely_valid', 'likely_invalid', 'mixed', 'insufficient_data'
    - `confidence_score` (int) - 0-100 aggregate confidence
    - `summary` (text) - synthesized narrative summary of all agent views
    - `key_points` (jsonb) - array of key takeaway strings
    - `agent_count` (int) - how many agent responses were synthesized
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled
  - Public read access (same as agent_responses)
  - No direct user writes (written only by edge function via service role)
*/

CREATE TABLE IF NOT EXISTS agent_consensus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  verdict text NOT NULL DEFAULT 'mixed',
  confidence_score int NOT NULL DEFAULT 50,
  summary text NOT NULL DEFAULT '',
  key_points jsonb NOT NULL DEFAULT '[]',
  agent_count int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_consensus_assumption_id ON agent_consensus(assumption_id);

ALTER TABLE agent_consensus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read agent consensus"
  ON agent_consensus FOR SELECT
  TO public
  USING (true);
