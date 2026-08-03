/*
  # Restore Assumption Forecasts, Risks, and Scenarios

  1. New Tables
    - `assumption_forecasts` - Per-assumption probability forecasts
    - `assumption_risks` - Risks associated with assumptions
    - `assumption_scenarios` - Scenarios that would play out under assumptions

  2. Security
    - RLS enabled on all tables
    - Authenticated users can read; only authors can modify their own
*/

-- Assumption Forecasts
CREATE TABLE IF NOT EXISTS assumption_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  probability integer NOT NULL CHECK (probability >= 0 AND probability <= 100),
  justification text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (assumption_id, user_id)
);

ALTER TABLE assumption_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assumption forecasts"
  ON assumption_forecasts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own assumption forecasts"
  ON assumption_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assumption forecasts"
  ON assumption_forecasts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own assumption forecasts"
  ON assumption_forecasts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Assumption Risks
CREATE TABLE IF NOT EXISTS assumption_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity integer NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assumption_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assumption risks"
  ON assumption_risks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert assumption risks"
  ON assumption_risks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete own assumption risks"
  ON assumption_risks FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Assumption Scenarios
CREATE TABLE IF NOT EXISTS assumption_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assumption_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assumption scenarios"
  ON assumption_scenarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own assumption scenarios"
  ON assumption_scenarios FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own assumption scenarios"
  ON assumption_scenarios FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_assumption_forecasts_assumption_id ON assumption_forecasts(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_risks_assumption_id ON assumption_risks(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_scenarios_assumption_id ON assumption_scenarios(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_scenarios_created_by ON assumption_scenarios(created_by);