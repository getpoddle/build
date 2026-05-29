/*
  # Create Rule-Based AI Agents System

  1. New Tables
    - `ai_agents`
      - `id` (uuid, primary key)
      - `name` (text) - Agent name like "The Skeptic", "Risk Analyst"
      - `role` (text) - Agent's role/specialty
      - `personality` (text) - Description of agent's perspective
      - `avatar_url` (text) - Agent's avatar image
      - `is_active` (boolean) - Whether agent is enabled
      - `created_at` (timestamptz)
      
    - `agent_responses`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, foreign key to ai_agents)
      - `assumption_id` (uuid, foreign key to pod_assumptions)
      - `response_type` (text) - "challenge", "risk", "alternative", "question"
      - `content` (text) - The generated response
      - `confidence_score` (integer) - How confident the agent is (1-100)
      - `created_at` (timestamptz)
      
    - `agent_response_templates`
      - `id` (uuid, primary key)
      - `agent_id` (uuid, foreign key to ai_agents)
      - `trigger_keywords` (text[]) - Keywords that trigger this template
      - `response_pattern` (text) - Template with placeholders
      - `response_type` (text) - Type of response
      - `priority` (integer) - Template priority (higher = used first)
      
  2. Security
    - Enable RLS on all tables
    - Public read access to agents and responses
    - Only system can create agent responses
    
  3. Functions
    - `generate_agent_response` - Rule-based logic to generate responses
*/

-- Create ai_agents table
CREATE TABLE IF NOT EXISTS ai_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL,
  personality text NOT NULL,
  avatar_url text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Create agent_responses table
CREATE TABLE IF NOT EXISTS agent_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  response_type text NOT NULL,
  content text NOT NULL,
  confidence_score integer DEFAULT 75 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  created_at timestamptz DEFAULT now()
);

-- Create agent_response_templates table
CREATE TABLE IF NOT EXISTS agent_response_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id uuid NOT NULL REFERENCES ai_agents(id) ON DELETE CASCADE,
  trigger_keywords text[] NOT NULL,
  response_pattern text NOT NULL,
  response_type text NOT NULL,
  priority integer DEFAULT 10,
  created_at timestamptz DEFAULT now()
);

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_agent_responses_agent ON agent_responses(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_responses_assumption ON agent_responses(assumption_id);
CREATE INDEX IF NOT EXISTS idx_agent_response_templates_agent ON agent_response_templates(agent_id);

-- Enable RLS
ALTER TABLE ai_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_response_templates ENABLE ROW LEVEL SECURITY;

-- Public read access to agents
CREATE POLICY "Anyone can view active agents"
  ON ai_agents FOR SELECT
  USING (is_active = true);

-- Public read access to agent responses
CREATE POLICY "Anyone can view agent responses"
  ON agent_responses FOR SELECT
  USING (true);

-- Public read access to templates (for debugging)
CREATE POLICY "Anyone can view agent templates"
  ON agent_response_templates FOR SELECT
  USING (true);

-- Insert default AI agents
INSERT INTO ai_agents (name, role, personality, avatar_url) VALUES
  ('The Skeptic', 'Critical Analyst', 'Questions assumptions, demands evidence, identifies flaws in logic', '/agent-skeptic.png'),
  ('Risk Analyst', 'Risk Assessment', 'Identifies potential risks, failure modes, and negative scenarios', '/agent-risk.png'),
  ('The Optimist', 'Opportunity Finder', 'Sees potential upsides, identifies positive scenarios, finds silver linings', '/agent-optimist.png'),
  ('Data Detective', 'Evidence Seeker', 'Requests data, cites statistics, looks for quantitative support', '/agent-data.png'),
  ('Devil''s Advocate', 'Contrarian', 'Takes opposing viewpoints, challenges consensus, explores alternatives', '/agent-devil.png')
ON CONFLICT DO NOTHING;

-- Function to extract keywords from text
CREATE OR REPLACE FUNCTION extract_keywords(text_content text)
RETURNS text[]
LANGUAGE plpgsql
AS $$
DECLARE
  words text[];
  important_words text[] := '{}';
  word text;
BEGIN
  -- Convert to lowercase and split into words
  words := regexp_split_to_array(lower(text_content), '\s+');
  
  -- Filter out common words and keep important ones
  FOREACH word IN ARRAY words
  LOOP
    IF length(word) > 4 AND 
       word NOT IN ('would', 'should', 'could', 'about', 'their', 'there', 'which', 'these', 'those') THEN
      important_words := array_append(important_words, word);
    END IF;
  END LOOP;
  
  RETURN important_words;
END;
$$;

-- Function to check if text contains percentage
CREATE OR REPLACE FUNCTION contains_percentage(text_content text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN text_content ~* '\d+%|\d+ percent|percentage';
END;
$$;

-- Function to check if text contains future date
CREATE OR REPLACE FUNCTION contains_future_date(text_content text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN text_content ~* '\d{4}|next year|by \d+|within \d+|in \d+ years?';
END;
$$;

-- Function to generate agent response using rules
CREATE OR REPLACE FUNCTION generate_agent_response(
  p_agent_id uuid,
  p_assumption_id uuid,
  p_assumption_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_response_id uuid;
  v_response_content text;
  v_response_type text;
  v_confidence integer;
  v_keywords text[];
  v_agent_name text;
BEGIN
  -- Get agent name
  SELECT name INTO v_agent_name FROM ai_agents WHERE id = p_agent_id;
  
  -- Extract keywords
  v_keywords := extract_keywords(p_assumption_text);
  
  -- Generate response based on agent type
  CASE v_agent_name
    WHEN 'The Skeptic' THEN
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'What data supports this specific percentage? I''d like to see the methodology and sample size used to arrive at this figure.';
        v_response_type := 'challenge';
        v_confidence := 85;
      ELSIF contains_future_date(p_assumption_text) THEN
        v_response_content := 'What factors could prevent this timeline from being accurate? History shows predictions about timing are often off by significant margins.';
        v_response_type := 'question';
        v_confidence := 80;
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('I''m skeptical of the assumptions around "%s". What evidence contradicts this claim? What are the weakest points in this reasoning?', v_keywords[1]);
        v_response_type := 'challenge';
        v_confidence := 75;
      ELSE
        v_response_content := 'This assumption lacks specificity. Can you provide more concrete criteria for what would make this true or false?';
        v_response_type := 'challenge';
        v_confidence := 70;
      END IF;
      
    WHEN 'Risk Analyst' THEN
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'Risk: If this percentage is even 10-20% off, the downstream impacts could be significant. What''s the margin of error?';
        v_response_type := 'risk';
        v_confidence := 80;
      ELSIF array_length(v_keywords, 1) > 1 THEN
        v_response_content := format('Three key risks: 1) %s dependency failure, 2) Unforeseen %s complications, 3) External market forces disrupting the %s assumption.', v_keywords[1], v_keywords[2], v_keywords[1]);
        v_response_type := 'risk';
        v_confidence := 85;
      ELSE
        v_response_content := 'I see potential failure modes here. What happens in a worst-case scenario? Have you stress-tested this assumption?';
        v_response_type := 'risk';
        v_confidence := 75;
      END IF;
      
    WHEN 'The Optimist' THEN
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('If this holds true, the upside for %s could be even greater than expected! I see additional opportunities here.', v_keywords[1]);
        v_response_type := 'alternative';
        v_confidence := 80;
      ELSE
        v_response_content := 'I see the positive potential here! This could open up opportunities we haven''t fully explored yet.';
        v_response_type := 'alternative';
        v_confidence := 75;
      END IF;
      
    WHEN 'Data Detective' THEN
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'Can you share the source for this percentage? I''d like to verify it against industry benchmarks and recent studies.';
        v_response_type := 'question';
        v_confidence := 90;
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('I need to see quantitative data on %s. What metrics are we tracking? Where can I find historical trends?', v_keywords[1]);
        v_response_type := 'question';
        v_confidence := 85;
      ELSE
        v_response_content := 'This needs supporting data. What are the key metrics we should be measuring to validate this assumption?';
        v_response_type := 'question';
        v_confidence := 80;
      END IF;
      
    WHEN 'Devil''s Advocate' THEN
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('What if the opposite is true? Perhaps %s actually indicates the inverse of what we''re assuming here.', v_keywords[1]);
        v_response_type := 'alternative';
        v_confidence := 75;
      ELSE
        v_response_content := 'Let me present the counter-argument: What if we''re looking at this from entirely the wrong angle?';
        v_response_type := 'alternative';
        v_confidence := 70;
      END IF;
  END CASE;
  
  -- Insert the response
  INSERT INTO agent_responses (agent_id, assumption_id, response_type, content, confidence_score)
  VALUES (p_agent_id, p_assumption_id, v_response_type, v_response_content, v_confidence)
  RETURNING id INTO v_response_id;
  
  RETURN v_response_id;
END;
$$;

-- Function to trigger agent responses when new assumption is created
CREATE OR REPLACE FUNCTION trigger_agent_responses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent record;
  v_random float;
BEGIN
  -- Generate responses from 2-3 random agents
  FOR v_agent IN 
    SELECT id, name FROM ai_agents 
    WHERE is_active = true 
    ORDER BY random() 
    LIMIT 3
  LOOP
    -- Generate response with some randomness (80% chance per agent)
    v_random := random();
    IF v_random > 0.2 THEN
      PERFORM generate_agent_response(v_agent.id, NEW.id, NEW.content);
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new assumptions
DROP TRIGGER IF EXISTS trigger_agent_responses_on_assumption ON pod_assumptions;
CREATE TRIGGER trigger_agent_responses_on_assumption
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_agent_responses();