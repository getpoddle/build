
/*
  # Add per-assumption forecasts and risks

  ## Summary
  Extends the assumptions system so each individual assumption can have its own:
  - Probability forecasts from members
  - Risks/concerns raised against it

  ## New Tables

  ### assumption_forecasts
  - `id` (uuid, pk)
  - `assumption_id` (uuid, fk -> pod_assumptions)
  - `user_id` (uuid, fk -> auth.users)
  - `probability` (integer 0-100) - how likely the assumption is to hold true
  - `justification` (text)
  - `created_at`, `updated_at`

  ### assumption_risks
  - `id` (uuid, pk)
  - `assumption_id` (uuid, fk -> pod_assumptions)
  - `title` (text)
  - `description` (text)
  - `severity` (integer 1-5)
  - `created_by` (uuid, fk -> auth.users)
  - `created_at`

  ## Security
  - RLS enabled on both tables
  - Authenticated users can read; only authors can modify their own rows
*/

CREATE TABLE IF NOT EXISTS assumption_forecasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS assumption_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  severity integer NOT NULL DEFAULT 3 CHECK (severity >= 1 AND severity <= 5),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_assumption_forecasts_assumption_id ON assumption_forecasts(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_risks_assumption_id ON assumption_risks(assumption_id);
