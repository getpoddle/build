/*
  # Agent Memory, Decision History & Scoring System

  ## Overview
  Turns the AI agent system from a stateless generator into a learning system with:
  1. Conversation memory per user per assumption (agents remember prior exchanges)
  2. Decision history — every agent run is recorded for longitudinal tracking
  3. User-specific context — stores user's stated expertise, priors, goals per assumption
  4. Decision scoring — structured confidence/disagreement/risk scores with prediction vs outcome tracking
  5. Outcome resolution — when an assumption resolves, compare prediction to reality

  ## New Tables

  ### agent_conversation_memory
  Full conversation history per user per assumption, structured so the edge function
  can retrieve recent turns and inject them as context into the next prompt.
  - user_id: whose conversation
  - assumption_id: which assumption the conversation is about
  - agent_id: which agent
  - role: "user" | "agent"
  - content: message text
  - turn_index: ordering

  ### user_assumption_context
  User-provided context that personalises agent responses.
  - user_id, assumption_id
  - expertise_level: novice | intermediate | expert
  - stated_prior: user's belief before agents respond (0-100, e.g. 70 = "I'm 70% confident this is true")
  - goals: free text — "I want to stress-test this before pitching to investors"
  - industry_context: "fintech startup" — colours all agent responses
  - updated_at

  ### agent_decision_runs
  Every time agents are generated for an assumption, record it as a "run".
  - run_id, assumption_id, user_id
  - agents_used: jsonb array of agent names
  - composite_confidence: 0-100 weighted average across all agent confidence_scores
  - composite_disagreement: 0-100 weighted average disagreement
  - composite_risk: 0-100 weighted average risk
  - verdict: mirrors agent_consensus.verdict
  - triggered_by: "user" | "auto" | "cron"
  - created_at

  ### assumption_prediction_scores
  The core "prediction vs outcome" tracking table.
  After an assumption resolves, record:
  - assumption_id, user_id
  - predicted_verdict: what agents predicted
  - predicted_confidence: composite score at time of prediction
  - actual_outcome: "validated" | "invalidated" | "partially_validated" | "inconclusive"
  - outcome_notes: free text explanation
  - accuracy_score: 0-100 (how well prediction matched outcome)
  - resolved_at
  - resolved_by: user_id who resolved it

  ## Security
  All tables have RLS enabled with restrictive policies.
*/

-- -----------------------------------------------------------------------
-- 1. agent_conversation_memory
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_conversation_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('user', 'agent')),
  content text NOT NULL,
  turn_index int NOT NULL DEFAULT 0,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_conversation_memory ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_conv_memory_user ON agent_conversation_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_memory_assumption ON agent_conversation_memory(assumption_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_memory_agent ON agent_conversation_memory(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_conv_memory_lookup ON agent_conversation_memory(user_id, assumption_id, agent_id, turn_index);

CREATE POLICY "Users can read own conversation memory"
  ON agent_conversation_memory FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversation memory"
  ON agent_conversation_memory FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own conversation memory"
  ON agent_conversation_memory FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- 2. user_assumption_context
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_assumption_context (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  expertise_level text NOT NULL DEFAULT 'intermediate' CHECK (expertise_level IN ('novice', 'intermediate', 'expert')),
  stated_prior int CHECK (stated_prior BETWEEN 0 AND 100),
  goals text DEFAULT '',
  industry_context text DEFAULT '',
  focus_areas text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, assumption_id)
);

ALTER TABLE user_assumption_context ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_assumption_ctx_user ON user_assumption_context(user_id);
CREATE INDEX IF NOT EXISTS idx_user_assumption_ctx_assumption ON user_assumption_context(assumption_id);

CREATE POLICY "Users can read own assumption context"
  ON user_assumption_context FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own assumption context"
  ON user_assumption_context FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own assumption context"
  ON user_assumption_context FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- 3. agent_decision_runs
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS agent_decision_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  agents_used jsonb NOT NULL DEFAULT '[]',
  composite_confidence int CHECK (composite_confidence BETWEEN 0 AND 100),
  composite_disagreement int CHECK (composite_disagreement BETWEEN 0 AND 100),
  composite_risk int CHECK (composite_risk BETWEEN 0 AND 100),
  verdict text CHECK (verdict IN ('likely_valid', 'likely_invalid', 'mixed', 'insufficient_data')),
  agent_count int NOT NULL DEFAULT 0,
  triggered_by text NOT NULL DEFAULT 'user' CHECK (triggered_by IN ('user', 'auto', 'cron')),
  run_metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_decision_runs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_agent_decision_runs_assumption ON agent_decision_runs(assumption_id);
CREATE INDEX IF NOT EXISTS idx_agent_decision_runs_user ON agent_decision_runs(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_decision_runs_created ON agent_decision_runs(created_at DESC);

CREATE POLICY "Users can read decision runs for their assumptions"
  ON agent_decision_runs FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM pod_assumptions pa
      JOIN pod_members pm ON pm.pod_id = pa.pod_id
      WHERE pa.id = assumption_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own decision runs"
  ON agent_decision_runs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- 4. assumption_prediction_scores
-- -----------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS assumption_prediction_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  decision_run_id uuid REFERENCES agent_decision_runs(id) ON DELETE SET NULL,
  predicted_verdict text CHECK (predicted_verdict IN ('likely_valid', 'likely_invalid', 'mixed', 'insufficient_data')),
  predicted_confidence int CHECK (predicted_confidence BETWEEN 0 AND 100),
  predicted_disagreement int CHECK (predicted_disagreement BETWEEN 0 AND 100),
  predicted_risk int CHECK (predicted_risk BETWEEN 0 AND 100),
  actual_outcome text CHECK (actual_outcome IN ('validated', 'invalidated', 'partially_validated', 'inconclusive')),
  outcome_notes text DEFAULT '',
  accuracy_score int CHECK (accuracy_score BETWEEN 0 AND 100),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(assumption_id, decision_run_id)
);

ALTER TABLE assumption_prediction_scores ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_prediction_scores_assumption ON assumption_prediction_scores(assumption_id);
CREATE INDEX IF NOT EXISTS idx_prediction_scores_user ON assumption_prediction_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_prediction_scores_resolved ON assumption_prediction_scores(resolved_at) WHERE resolved_at IS NOT NULL;

CREATE POLICY "Pod members can read prediction scores"
  ON assumption_prediction_scores FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM pod_assumptions pa
      JOIN pod_members pm ON pm.pod_id = pa.pod_id
      WHERE pa.id = assumption_id AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own prediction scores"
  ON assumption_prediction_scores FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own prediction scores"
  ON assumption_prediction_scores FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------------------------------
-- 5. Helper function: get_agent_conversation_history
-- Returns last N turns for a user/assumption/agent combo
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_agent_conversation_history(
  p_user_id uuid,
  p_assumption_id uuid,
  p_agent_id uuid,
  p_limit int DEFAULT 10
)
RETURNS TABLE(role text, content text, turn_index int, created_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role, content, turn_index, created_at
  FROM agent_conversation_memory
  WHERE user_id = p_user_id
    AND assumption_id = p_assumption_id
    AND agent_id = p_agent_id
  ORDER BY turn_index DESC
  LIMIT p_limit;
$$;

-- -----------------------------------------------------------------------
-- 6. Helper function: calculate_accuracy_score
-- Given predicted verdict + confidence vs actual outcome, returns 0-100
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION calculate_accuracy_score(
  p_predicted_verdict text,
  p_predicted_confidence int,
  p_actual_outcome text
)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_score int := 0;
  confidence_weight float := 0;
BEGIN
  IF p_predicted_verdict IS NULL OR p_actual_outcome IS NULL THEN
    RETURN NULL;
  END IF;

  IF (p_predicted_verdict = 'likely_valid' AND p_actual_outcome = 'validated') OR
     (p_predicted_verdict = 'likely_invalid' AND p_actual_outcome = 'invalidated') THEN
    base_score := 100;
  ELSIF (p_predicted_verdict = 'likely_valid' AND p_actual_outcome = 'partially_validated') OR
        (p_predicted_verdict = 'likely_invalid' AND p_actual_outcome = 'partially_validated') OR
        (p_predicted_verdict = 'mixed' AND p_actual_outcome IN ('partially_validated', 'inconclusive')) THEN
    base_score := 65;
  ELSIF p_predicted_verdict = 'mixed' AND p_actual_outcome IN ('validated', 'invalidated') THEN
    base_score := 40;
  ELSIF p_predicted_verdict = 'insufficient_data' THEN
    base_score := 50;
  ELSE
    base_score := 10;
  END IF;

  confidence_weight := COALESCE(p_predicted_confidence, 50) / 100.0;
  RETURN LEAST(100, GREATEST(0, ROUND(base_score * (0.6 + 0.4 * confidence_weight))::int));
END;
$$;
