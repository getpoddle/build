/*
  # Add Assumption Votes Table

  ## Summary
  Adds a lightweight agree/disagree voting system for individual insight cards (pod_assumptions).

  ## New Tables
  - `assumption_votes`
    - `id` (uuid, primary key)
    - `assumption_id` (uuid, FK to pod_assumptions)
    - `user_id` (uuid, FK to profiles)
    - `vote` (text, either 'agree' or 'disagree')
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)
    - Unique constraint: one vote per user per assumption

  ## Security
  - RLS enabled
  - Authenticated users can view all votes (for aggregate counts)
  - Users can only insert/update/delete their own votes

  ## Notes
  1. This enables the personal position feature on insight cards
  2. Aggregate counts can be computed client-side from fetched votes
  3. Unique constraint prevents duplicate votes; use upsert to change vote
*/

CREATE TABLE IF NOT EXISTS assumption_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote text NOT NULL CHECK (vote IN ('agree', 'disagree')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (assumption_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_assumption_votes_assumption_id ON assumption_votes(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_votes_user_id ON assumption_votes(user_id);

ALTER TABLE assumption_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view all votes"
  ON assumption_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own votes"
  ON assumption_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own votes"
  ON assumption_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON assumption_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
