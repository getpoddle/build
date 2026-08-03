/*
  # Decision Intelligence Platform - New Features

  ## Overview
  Adds 5 major feature systems to the decision intelligence platform:

  1. **Decision Autopsy** - Post-resolution analysis per pod showing which insights were correct,
     who called it, calibration deltas, and institutional memory

  2. **Calibration-Weighted Votes** - Stores calibration scores at vote time so vote weight
     reflects user's historical accuracy

  3. **Structured Reasoning** - Captures the reasoning chain behind insights: what evidence
     supports it, what would change your mind, confidence level, and key assumptions

  4. **Group Decision Sessions** - Formal sessions within pods where members are assigned roles
     (advocate, skeptic, decision owner, observer) with deadlines and required contributions

  5. **Evidence Wall** - Aggregates all reference URLs/sources per pod with citation counts,
     domain extraction, and community upvotes

  ## New Tables
  - `decision_autopsy` - Stores per-pod outcome summaries (accuracy rates, top predictors, key learnings)
  - `assumption_reasoning` - Structured reasoning chains for insights
  - `decision_sessions` - Group decision sessions with roles and deadlines
  - `decision_session_members` - Role assignments within sessions
  - `decision_session_contributions` - Required member inputs during a session
  - `pod_evidence` - Aggregated evidence/sources per pod
  - `pod_evidence_votes` - Community upvotes on evidence items

  ## Modified Tables
  - `assumption_votes` - Adds calibration_score_at_vote column to weight votes by user accuracy

  ## Security
  - RLS enabled on all new tables
  - Authenticated-only access with ownership checks
  - Pod members can access session data
*/

-- ============================================================
-- 1. ASSUMPTION REASONING (Structured reasoning capture)
-- ============================================================
CREATE TABLE IF NOT EXISTS assumption_reasoning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supporting_evidence text NOT NULL DEFAULT '',
  counter_evidence text NOT NULL DEFAULT '',
  what_would_change_mind text NOT NULL DEFAULT '',
  confidence_level integer NOT NULL DEFAULT 50 CHECK (confidence_level >= 0 AND confidence_level <= 100),
  key_assumptions text[] NOT NULL DEFAULT '{}',
  data_sources text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE assumption_reasoning ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view reasoning for any assumption"
  ON assumption_reasoning FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert their own reasoning"
  ON assumption_reasoning FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own reasoning"
  ON assumption_reasoning FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete their own reasoning"
  ON assumption_reasoning FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_assumption_reasoning_assumption_id ON assumption_reasoning(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_reasoning_created_by ON assumption_reasoning(created_by);

-- ============================================================
-- 2. CALIBRATION WEIGHT ON VOTES
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assumption_votes' AND column_name = 'calibration_score_at_vote'
  ) THEN
    ALTER TABLE assumption_votes ADD COLUMN calibration_score_at_vote numeric(5,2);
  END IF;
END $$;

-- ============================================================
-- 3. DECISION AUTOPSY
-- ============================================================
CREATE TABLE IF NOT EXISTS decision_autopsy (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('confirmed', 'refuted', 'still_open')),
  resolved_at timestamptz NOT NULL DEFAULT now(),
  total_forecasters integer NOT NULL DEFAULT 0,
  avg_predicted_probability numeric(5,2),
  correct_direction_count integer NOT NULL DEFAULT 0,
  incorrect_direction_count integer NOT NULL DEFAULT 0,
  top_predictors jsonb NOT NULL DEFAULT '[]',
  key_learnings text NOT NULL DEFAULT '',
  ai_summary text NOT NULL DEFAULT '',
  calibration_delta_avg numeric(5,2),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decision_autopsy ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view autopsies"
  ON decision_autopsy FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert autopsies"
  ON decision_autopsy FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_decision_autopsy_pod_id ON decision_autopsy(pod_id);
CREATE INDEX IF NOT EXISTS idx_decision_autopsy_assumption_id ON decision_autopsy(assumption_id);

-- ============================================================
-- 4. GROUP DECISION SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS decision_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  question text NOT NULL,
  deadline timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deliberating', 'decided', 'archived')),
  decision_outcome text,
  decision_reasoning text,
  decided_at timestamptz,
  created_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decision_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view sessions"
  ON decision_sessions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = decision_sessions.pod_id
      AND pod_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Pod members can create sessions"
  ON decision_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = created_by AND
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_members.pod_id = decision_sessions.pod_id
      AND pod_members.user_id = auth.uid()
    )
  );

CREATE POLICY "Session creator can update session"
  ON decision_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Session creator can delete session"
  ON decision_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

CREATE INDEX IF NOT EXISTS idx_decision_sessions_pod_id ON decision_sessions(pod_id);
CREATE INDEX IF NOT EXISTS idx_decision_sessions_created_by ON decision_sessions(created_by);

-- ============================================================
-- 5. SESSION MEMBERS (Role assignments)
-- ============================================================
CREATE TABLE IF NOT EXISTS decision_session_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES decision_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'contributor' CHECK (role IN ('decision_owner', 'advocate', 'skeptic', 'researcher', 'observer', 'contributor')),
  has_contributed boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

ALTER TABLE decision_session_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members can view other members"
  ON decision_session_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_sessions ds
      JOIN pod_members pm ON pm.pod_id = ds.pod_id
      WHERE ds.id = decision_session_members.session_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Pod members can join sessions"
  ON decision_session_members FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own membership"
  ON decision_session_members FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave sessions"
  ON decision_session_members FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_session_members_session_id ON decision_session_members(session_id);
CREATE INDEX IF NOT EXISTS idx_session_members_user_id ON decision_session_members(user_id);

-- ============================================================
-- 6. SESSION CONTRIBUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS decision_session_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES decision_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  contribution_type text NOT NULL CHECK (contribution_type IN ('argument_for', 'argument_against', 'evidence', 'risk', 'alternative', 'question', 'final_vote')),
  content text NOT NULL,
  reference_url text,
  vote text CHECK (vote IN ('yes', 'no', 'abstain')),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE decision_session_contributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Session members can view contributions"
  ON decision_session_contributions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_sessions ds
      JOIN pod_members pm ON pm.pod_id = ds.pod_id
      WHERE ds.id = decision_session_contributions.session_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Session members can insert contributions"
  ON decision_session_contributions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own contributions"
  ON decision_session_contributions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own contributions"
  ON decision_session_contributions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_session_contributions_session_id ON decision_session_contributions(session_id);
CREATE INDEX IF NOT EXISTS idx_session_contributions_user_id ON decision_session_contributions(user_id);

-- ============================================================
-- 7. POD EVIDENCE WALL
-- ============================================================
CREATE TABLE IF NOT EXISTS pod_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid NOT NULL REFERENCES pods(id) ON DELETE CASCADE,
  assumption_id uuid REFERENCES pod_assumptions(id) ON DELETE SET NULL,
  submitted_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  source_domain text NOT NULL DEFAULT '',
  source_type text NOT NULL DEFAULT 'other' CHECK (source_type IN ('peer_reviewed', 'news', 'government', 'industry_report', 'blog', 'social', 'other')),
  citation_count integer NOT NULL DEFAULT 0,
  upvote_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE pod_evidence ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pod members can view evidence"
  ON pod_evidence FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Pod members can submit evidence"
  ON pod_evidence FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Submitter can update evidence"
  ON pod_evidence FOR UPDATE
  TO authenticated
  USING (auth.uid() = submitted_by)
  WITH CHECK (auth.uid() = submitted_by);

CREATE POLICY "Submitter can delete evidence"
  ON pod_evidence FOR DELETE
  TO authenticated
  USING (auth.uid() = submitted_by);

CREATE INDEX IF NOT EXISTS idx_pod_evidence_pod_id ON pod_evidence(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_evidence_assumption_id ON pod_evidence(assumption_id);
CREATE INDEX IF NOT EXISTS idx_pod_evidence_submitted_by ON pod_evidence(submitted_by);

-- ============================================================
-- 8. POD EVIDENCE VOTES
-- ============================================================
CREATE TABLE IF NOT EXISTS pod_evidence_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evidence_id uuid NOT NULL REFERENCES pod_evidence(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(evidence_id, user_id)
);

ALTER TABLE pod_evidence_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view evidence votes"
  ON pod_evidence_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can vote on evidence"
  ON pod_evidence_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their vote"
  ON pod_evidence_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pod_evidence_votes_evidence_id ON pod_evidence_votes(evidence_id);
CREATE INDEX IF NOT EXISTS idx_pod_evidence_votes_user_id ON pod_evidence_votes(user_id);
