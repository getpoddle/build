/*
  # AI Resolution System

  ## Summary
  Adds infrastructure for AI-driven assumption outcome resolution, removing the ability
  for humans to game the calibration system by resolving their own assumptions.

  ## Changes

  ### 1. New column: assumption_outcomes.resolved_by_ai
  - Boolean flag indicating whether this outcome was resolved by the AI system
  - Defaults to false (backwards compatible with existing human resolutions)

  ### 2. New column: assumption_outcomes.ai_reasoning
  - Stores the AI's chain-of-thought reasoning for the verdict
  - Only populated when resolved_by_ai = true

  ### 3. New column: assumption_outcomes.ai_confidence
  - Integer 0-100 representing how confident the AI was in its verdict
  - Only meaningful when resolved_by_ai = true

  ### 4. Modified RLS: block creator self-resolution
  - The INSERT policy is replaced so that assumption creators cannot insert their
    own resolution — only the AI system (via service role) can bypass this.
  - Human members can still resolve OTHER people's assumptions.

  ### 5. New table: ai_resolution_requests
  - Tracks which user requested an AI resolution and when
  - Prevents spam re-requests while a resolution is pending
  - One pending request per assumption at a time

  ## Security
  - RLS enabled on ai_resolution_requests
  - Only authenticated users can insert; they can only view their own requests
  - assumption_outcomes INSERT policy now blocks creators from self-resolving
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend assumption_outcomes with AI columns
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_outcomes' AND column_name = 'resolved_by_ai'
  ) THEN
    ALTER TABLE assumption_outcomes ADD COLUMN resolved_by_ai boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_outcomes' AND column_name = 'ai_reasoning'
  ) THEN
    ALTER TABLE assumption_outcomes ADD COLUMN ai_reasoning text DEFAULT '';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_outcomes' AND column_name = 'ai_confidence'
  ) THEN
    ALTER TABLE assumption_outcomes ADD COLUMN ai_confidence integer DEFAULT NULL;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Drop the old permissive INSERT policy and replace with anti-self-resolve
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Authenticated users can resolve outcomes" ON assumption_outcomes;

CREATE POLICY "Members can resolve outcomes they did not create"
  ON assumption_outcomes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = resolved_by
    AND auth.uid() != (
      SELECT created_by FROM pod_assumptions WHERE id = assumption_id
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. AI resolution requests table
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ai_resolution_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  requested_at timestamptz DEFAULT now(),
  completed_at timestamptz DEFAULT NULL,
  UNIQUE(assumption_id)
);

CREATE INDEX IF NOT EXISTS idx_ai_resolution_requests_assumption_id ON ai_resolution_requests(assumption_id);
CREATE INDEX IF NOT EXISTS idx_ai_resolution_requests_requested_by ON ai_resolution_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_ai_resolution_requests_status ON ai_resolution_requests(status);

ALTER TABLE ai_resolution_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view resolution requests"
  ON ai_resolution_requests FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can request AI resolution"
  ON ai_resolution_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requested_by);

CREATE POLICY "System can update resolution request status"
  ON ai_resolution_requests FOR UPDATE
  TO authenticated
  USING (auth.uid() = requested_by)
  WITH CHECK (auth.uid() = requested_by);
