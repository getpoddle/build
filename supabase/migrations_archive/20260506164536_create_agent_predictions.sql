/*
  # Agent Predictions — Long-Horizon Forecasts

  1. New Tables
    - `agent_predictions`
      - `id` (uuid, primary key)
      - `industry` (text) — one of 'technology', 'finance', 'entrepreneurship'
      - `agent_role` (text) — which persona made the prediction
      - `headline` (text) — one-line bold claim
      - `thesis` (text) — 2-3 sentence rationale
      - `horizon_years` (int) — 5 or 10
      - `confidence` (int 0-100) — agent-stated confidence
      - `signal_strength` (text) — 'weak' | 'building' | 'strong'
      - `contrarian` (boolean) — true when the claim runs against consensus
      - `evidence` (jsonb) — list of observable signals supporting the claim
      - `implications` (jsonb) — list of downstream consequences
      - `resolved_at` (timestamptz, nullable) — set when outcome is evaluated
      - `outcome` (text, nullable) — 'correct' | 'partial' | 'wrong' once resolved
      - `created_at` (timestamptz default now)

  2. Security
    - RLS enabled
    - Public read (investors + users can view)
    - Service-role only for writes

  3. Indexes
    - industry + horizon_years for page filters
    - created_at desc for recency ordering
*/

CREATE TABLE IF NOT EXISTS agent_predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  industry text NOT NULL,
  agent_role text NOT NULL,
  headline text NOT NULL,
  thesis text NOT NULL,
  horizon_years int NOT NULL DEFAULT 5,
  confidence int NOT NULL DEFAULT 60,
  signal_strength text NOT NULL DEFAULT 'building',
  contrarian boolean NOT NULL DEFAULT false,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  implications jsonb NOT NULL DEFAULT '[]'::jsonb,
  resolved_at timestamptz,
  outcome text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_predictions_industry_check
    CHECK (industry IN ('technology', 'finance', 'entrepreneurship')),
  CONSTRAINT agent_predictions_horizon_check
    CHECK (horizon_years IN (5, 10)),
  CONSTRAINT agent_predictions_confidence_check
    CHECK (confidence BETWEEN 0 AND 100),
  CONSTRAINT agent_predictions_signal_check
    CHECK (signal_strength IN ('weak', 'building', 'strong'))
);

ALTER TABLE agent_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read agent predictions"
  ON agent_predictions FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_agent_predictions_industry_horizon
  ON agent_predictions (industry, horizon_years);
CREATE INDEX IF NOT EXISTS idx_agent_predictions_created_at
  ON agent_predictions (created_at DESC);
