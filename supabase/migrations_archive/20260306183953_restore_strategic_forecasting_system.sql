/*
  # Restore Strategic Forecasting System

  1. Modified Tables
    - `pods`: Add back time_horizon, domain, question_text, forecast_count, avg_probability, disagreement_level

  2. New Tables
    - `pod_assumptions` - Base assumptions for strategic questions
    - `assumption_challenges` - User challenges to assumptions  
    - `pod_options` - Strategic options/paths
    - `pod_risks` - Risk tracking
    - `pod_forecasts` - User probability forecasts

  3. Security
    - RLS enabled on all tables
    - Authenticated users can read; only authors can modify their own
*/

-- Add strategic fields to pods
ALTER TABLE pods
  ADD COLUMN IF NOT EXISTS time_horizon text DEFAULT '10Y',
  ADD COLUMN IF NOT EXISTS domain text DEFAULT 'General',
  ADD COLUMN IF NOT EXISTS question_text text,
  ADD COLUMN IF NOT EXISTS forecast_count integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_probability numeric(5,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disagreement_level integer DEFAULT 0;

-- Pod Assumptions
CREATE TABLE IF NOT EXISTS pod_assumptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_by uuid NOT NULL REFERENCES profiles(id),
  challenge_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pod_assumptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assumptions"
  ON pod_assumptions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert assumptions"
  ON pod_assumptions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can update their assumptions"
  ON pod_assumptions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can delete their assumptions"
  ON pod_assumptions FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Assumption Challenges
CREATE TABLE IF NOT EXISTS assumption_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE assumption_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read challenges"
  ON assumption_challenges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert challenges"
  ON assumption_challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete their challenges"
  ON assumption_challenges FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Strategic Options
CREATE TABLE IF NOT EXISTS pod_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL,
  implementation_notes text,
  capital_notes text,
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE pod_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read options"
  ON pod_options FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert options"
  ON pod_options FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can update their options"
  ON pod_options FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can delete their options"
  ON pod_options FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Pod Risks
CREATE TABLE IF NOT EXISTS pod_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  option_id uuid REFERENCES pod_options(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  category text NOT NULL DEFAULT 'execution',
  severity integer NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
  created_by uuid NOT NULL REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE pod_risks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read risks"
  ON pod_risks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert risks"
  ON pod_risks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can update their risks"
  ON pod_risks FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authors can delete their risks"
  ON pod_risks FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Pod Forecasts
CREATE TABLE IF NOT EXISTS pod_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  probability integer NOT NULL CHECK (probability >= 0 AND probability <= 100),
  justification text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(pod_id, user_id)
);

ALTER TABLE pod_forecasts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read forecasts"
  ON pod_forecasts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own forecast"
  ON pod_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own forecast"
  ON pod_forecasts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own forecast"
  ON pod_forecasts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Function to update pod forecast stats
CREATE OR REPLACE FUNCTION update_pod_forecast_stats()
RETURNS trigger AS $$
DECLARE
  v_pod_id uuid;
  v_count integer;
  v_avg numeric;
  v_stddev numeric;
  v_disagreement integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_pod_id := OLD.pod_id;
  ELSE
    v_pod_id := NEW.pod_id;
  END IF;

  SELECT
    COUNT(*),
    COALESCE(AVG(probability), 0),
    COALESCE(STDDEV(probability), 0)
  INTO v_count, v_avg, v_stddev
  FROM pod_forecasts
  WHERE pod_id = v_pod_id;

  v_disagreement := LEAST(100, ROUND((v_stddev / 50.0) * 100));

  UPDATE pods SET
    forecast_count = v_count,
    avg_probability = v_avg,
    disagreement_level = v_disagreement
  WHERE id = v_pod_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_forecast_change ON pod_forecasts;
CREATE TRIGGER on_forecast_change
  AFTER INSERT OR UPDATE OR DELETE ON pod_forecasts
  FOR EACH ROW EXECUTE FUNCTION update_pod_forecast_stats();

-- Function to update assumption challenge count
CREATE OR REPLACE FUNCTION update_assumption_challenge_count()
RETURNS trigger AS $$
DECLARE
  v_assumption_id uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_assumption_id := OLD.assumption_id;
  ELSE
    v_assumption_id := NEW.assumption_id;
  END IF;

  UPDATE pod_assumptions SET
    challenge_count = (SELECT COUNT(*) FROM assumption_challenges WHERE assumption_id = v_assumption_id)
  WHERE id = v_assumption_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_challenge_change ON assumption_challenges;
CREATE TRIGGER on_challenge_change
  AFTER INSERT OR DELETE ON assumption_challenges
  FOR EACH ROW EXECUTE FUNCTION update_assumption_challenge_count();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pod_assumptions_pod_id ON pod_assumptions(pod_id);
CREATE INDEX IF NOT EXISTS idx_assumption_challenges_assumption_id ON assumption_challenges(assumption_id);
CREATE INDEX IF NOT EXISTS idx_pod_options_pod_id ON pod_options(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_risks_pod_id ON pod_risks(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_forecasts_pod_id ON pod_forecasts(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_forecasts_user_id ON pod_forecasts(user_id);