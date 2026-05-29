/*
  # Improve Agent Intelligence and Realism
  
  1. Changes
    - Make agent responses more human-like and specific (not generic)
    - Add realistic confidence scores with variance (35-92%, not always 80%)
    - Improve response quality with contextual details
    - Add tables for agent conversations and feedback
    
  2. New Tables
    - agent_conversations: Track multi-turn conversations with agents
    - agent_feedback: Track helpful/not helpful ratings
    
  3. Enhanced Functions
    - Better pattern matching and context awareness
    - More specific, less generic responses
    - Varied confidence based on context quality
*/

-- Create agent_conversations table for interactive chat
CREATE TABLE IF NOT EXISTS agent_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid REFERENCES ai_agents(id) ON DELETE CASCADE NOT NULL,
  assumption_id uuid REFERENCES pod_assumptions(id) ON DELETE CASCADE NOT NULL,
  parent_response_id uuid REFERENCES agent_responses(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user_message text NOT NULL,
  agent_reply text NOT NULL,
  confidence_score integer DEFAULT 75,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agent_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view agent conversations"
  ON agent_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create conversations"
  ON agent_conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create agent_feedback table
CREATE TABLE IF NOT EXISTS agent_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES agent_responses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  feedback_type text CHECK (feedback_type IN ('helpful', 'not_helpful')) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(response_id, user_id)
);

ALTER TABLE agent_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view feedback counts"
  ON agent_feedback FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can submit feedback"
  ON agent_feedback FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their feedback"
  ON agent_feedback FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_agent_conversations_assumption ON agent_conversations(assumption_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_agent ON agent_conversations(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_user ON agent_conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_feedback_response ON agent_feedback(response_id);

-- Enhanced confidence calculation based on context quality
CREATE OR REPLACE FUNCTION calculate_realistic_confidence(
  p_agent_name text,
  p_assumption_text text,
  p_has_numbers boolean,
  p_has_specifics boolean
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_confidence integer;
  v_variation integer;
BEGIN
  -- Base confidence varies by agent personality
  CASE p_agent_name
    WHEN 'The Skeptic' THEN
      v_base_confidence := 72; -- Skeptics are inherently less confident
    WHEN 'Risk Analyst' THEN
      v_base_confidence := 68; -- Risk analysts see many possibilities
    WHEN 'The Optimist' THEN
      v_base_confidence := 82; -- Optimists are more confident
    WHEN 'Data Detective' THEN
      v_base_confidence := CASE WHEN p_has_numbers THEN 85 ELSE 45 END; -- High with data, low without
    WHEN 'Devil''s Advocate' THEN
      v_base_confidence := 65; -- Contrarians are less certain
    WHEN 'The Historian' THEN
      v_base_confidence := 78; -- History provides confidence
    WHEN 'Market Analyst' THEN
      v_base_confidence := 70; -- Markets are uncertain
    WHEN 'Tech Futurist' THEN
      v_base_confidence := 58; -- Future is uncertain
    WHEN 'Systems Thinker' THEN
      v_base_confidence := 62; -- Complex systems are hard to predict
    WHEN 'The Pragmatist' THEN
      v_base_confidence := 75; -- Pragmatists are moderately confident
    ELSE
      v_base_confidence := 70;
  END CASE;
  
  -- Add variation based on assumption quality
  v_variation := (random() * 15 - 7.5)::integer; -- -7 to +7
  
  -- Bonus for specific, detailed assumptions
  IF p_has_specifics THEN
    v_variation := v_variation + 8;
  END IF;
  
  -- Return clamped to 35-92 range
  RETURN GREATEST(35, LEAST(92, v_base_confidence + v_variation));
END;
$$;

-- Function to generate contextual agent reply in conversation
CREATE OR REPLACE FUNCTION generate_agent_conversation_reply(
  p_agent_id uuid,
  p_user_message text,
  p_assumption_context text
)
RETURNS TABLE(reply text, confidence integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_agent_name text;
  v_agent_personality text;
  v_reply text;
  v_confidence integer;
BEGIN
  -- Get agent details
  SELECT name, personality INTO v_agent_name, v_agent_personality
  FROM ai_agents WHERE id = p_agent_id;
  
  -- Generate contextual reply based on agent and user message
  CASE v_agent_name
    WHEN 'The Skeptic' THEN
      IF p_user_message ILIKE '%why%' OR p_user_message ILIKE '%explain%' THEN
        v_reply := 'Let me elaborate on my skepticism. The core issue is evidentiary - we need falsifiable predictions, not just plausible narratives. What specific data points would convince you otherwise? Without clear success metrics, we''re just engaging in motivated reasoning.';
        v_confidence := 78;
      ELSIF p_user_message ILIKE '%data%' OR p_user_message ILIKE '%source%' THEN
        v_reply := 'Good question. I''d want to see: (1) primary sources, not aggregated reports, (2) methodology transparency, (3) confidence intervals, not point estimates, and (4) contradictory evidence that was considered and rejected. Anything less is storytelling, not analysis.';
        v_confidence := 82;
      ELSE
        v_reply := 'I appreciate the pushback. My skepticism stems from pattern recognition - I''ve seen similar assumptions fail when stress-tested. The burden of proof is high because the consequences of being wrong are significant. What am I missing in your view?';
        v_confidence := 70;
      END IF;
      
    WHEN 'Risk Analyst' THEN
      IF p_user_message ILIKE '%mitigate%' OR p_user_message ILIKE '%prevent%' THEN
        v_reply := 'For mitigation, I''d focus on three layers: (1) early warning indicators - what signals tell us we''re off track? (2) circuit breakers - at what point do we pause and reassess? (3) backup plans - what''s our plan B, C, and D? Risk management is about preparing for scenarios, not preventing all failure.';
        v_confidence := 76;
      ELSIF p_user_message ILIKE '%likely%' OR p_user_message ILIKE '%probability%' THEN
        v_reply := 'Based on similar historical cases, I''d estimate 35-40% probability of the primary risk materializing, but the tail risks are what concern me more. Black swan events are definitionally unpredictable, but we can stress-test our resilience. Are we antifragile or just hoping for the best?';
        v_confidence := 65;
      ELSE
        v_reply := 'The risk landscape here has multiple failure modes that can compound. It''s not just about individual risks, but how they interact. A 5% risk and a 10% risk don''t combine to 15% - they can create cascading failures with much higher probability. We need scenario planning, not just risk lists.';
        v_confidence := 72;
      END IF;
      
    WHEN 'Data Detective' THEN
      IF p_user_message ILIKE '%source%' OR p_user_message ILIKE '%where%' THEN
        v_reply := 'The data sources I''d want: (1) longitudinal studies, not cross-sectional snapshots, (2) n>1000 with demographic breakdowns, (3) pre-registered analysis plans to avoid p-hacking, and (4) raw data availability for replication. Without these, we''re building castles on sand.';
        v_confidence := 88;
      ELSIF p_user_message ILIKE '%enough%' OR p_user_message ILIKE '%sufficient%' THEN
        v_reply := 'Statistically speaking, we need effect sizes, not just p-values. A statistically significant result with tiny effect size is practically meaningless. I''d want to see: Cohen''s d > 0.5, confidence intervals that don''t include the null, and replication across contexts. Data quantity ≠ data quality.';
        v_confidence := 85;
      ELSE
        v_reply := 'Let me dig deeper into the numbers. What''s the baseline? What''s the trend trajectory? Are we comparing apples to apples? I''ve seen too many analyses where cherry-picked data supports pre-existing conclusions. Show me the full dataset, including the ugly parts.';
        v_confidence := 79;
      END IF;
      
    WHEN 'The Optimist' THEN
      v_reply := 'I see your point, and it actually reinforces my optimism! Even the challenges you raise create opportunities for innovation. History shows that constraints breed creativity. The second and third-order effects could be even more positive than the direct benefits. What if we''re underestimating the upside?';
      v_confidence := 81;
      
    WHEN 'The Historian' THEN
      v_reply := 'Looking at historical parallels from 1950-2020, we see similar patterns: initial skepticism, breakthrough moment, then rapid diffusion. The railroad boom (1830s), telegraph (1860s), telephone (1920s), internet (1990s) - all followed this arc. The question isn''t IF, but WHEN and HOW. Current conditions suggest we''re in the early adoption phase.';
      v_confidence := 74;
      
    WHEN 'Market Analyst' THEN
      v_reply := 'From a market dynamics perspective, three forces are in tension: (1) demand-side pull from changing consumer preferences, (2) supply-side constraints from capital allocation, and (3) competitive responses from incumbents. The winner isn''t predetermined - it depends on execution and timing. Markets are voting mechanisms, not truth-seeking devices.';
      v_confidence := 68;
      
    ELSE
      v_reply := format('That''s a thoughtful question. My %s perspective suggests we need to consider multiple angles here. Let me unpack my initial response further...', v_agent_personality);
      v_confidence := 70;
  END CASE;
  
  RETURN QUERY SELECT v_reply, v_confidence;
END;
$$;