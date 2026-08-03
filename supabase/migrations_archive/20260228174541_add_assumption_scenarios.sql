/*
  # Add Assumption Scenarios

  ## Summary
  Adds a new `assumption_scenarios` table to allow members to define scenarios
  that would play out under a specific assumption — answering "if this assumption
  holds, what scenarios become likely?"

  ## New Tables
  - `assumption_scenarios`
    - `id` (uuid, primary key)
    - `assumption_id` (uuid, FK to pod_assumptions)
    - `title` (text, required)
    - `description` (text, optional)
    - `created_by` (uuid, FK to auth.users)
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled with policies for authenticated read, member insert/delete
*/

CREATE TABLE IF NOT EXISTS assumption_scenarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assumption_scenarios_assumption_id ON assumption_scenarios(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_scenarios_created_by ON assumption_scenarios(created_by);

ALTER TABLE assumption_scenarios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read assumption scenarios"
  ON assumption_scenarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own assumption scenarios"
  ON assumption_scenarios FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can delete own assumption scenarios"
  ON assumption_scenarios FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));
