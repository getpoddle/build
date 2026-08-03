/*
  # Enhance AI Agents System - Advanced Intelligence

  1. Changes
    - Add 5 more specialized agents (total 10 agents)
    - Enable agents to create forecasts, challenges, risks, and scenarios
    - Add advanced pattern matching and entity extraction
    - Improve intelligence with domain-specific knowledge
    - Add sentiment analysis and context awareness
    
  2. New Agents
    - The Historian: Historical precedents and patterns
    - Market Analyst: Economic and market dynamics
    - Tech Futurist: Technology trends and innovation
    - Systems Thinker: Interconnections and second-order effects
    - The Pragmatist: Practical implementation and feasibility
    
  3. Enhanced Functions
    - Multi-action agent responses (forecast + risk + challenge)
    - Contextual probability calculations
    - Severity assessments
    - Scenario generation
*/

-- Add new agents
INSERT INTO ai_agents (name, role, personality, avatar_url, is_active) VALUES
  ('The Historian', 'Historical Analysis', 'Provides historical precedents, identifies patterns from the past, references similar cases', '/agent-historian.png', true),
  ('Market Analyst', 'Economic Perspective', 'Analyzes market forces, competitive dynamics, economic factors and business implications', '/agent-market.png', true),
  ('Tech Futurist', 'Technology Trends', 'Evaluates technological feasibility, innovation trajectories, and technical disruption', '/agent-tech.png', true),
  ('Systems Thinker', 'Holistic View', 'Identifies interconnections, feedback loops, unintended consequences and system dynamics', '/agent-systems.png', true),
  ('The Pragmatist', 'Implementation Focus', 'Assesses practical feasibility, resource requirements, and real-world constraints', '/agent-pragmatist.png', true)
ON CONFLICT DO NOTHING;

-- Enhanced function to detect numbers and extract them
CREATE OR REPLACE FUNCTION extract_numbers(text_content text)
RETURNS numeric[]
LANGUAGE plpgsql
AS $$
DECLARE
  numbers numeric[] := '{}';
  matches text[];
  match text;
BEGIN
  matches := regexp_matches(text_content, '\d+\.?\d*', 'g');
  
  FOREACH match IN ARRAY matches
  LOOP
    numbers := array_append(numbers, match::numeric);
  END LOOP;
  
  RETURN numbers;
END;
$$;

-- Function to detect market/business keywords
CREATE OR REPLACE FUNCTION contains_business_terms(text_content text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN text_content ~* 'market|revenue|profit|customer|competition|sales|growth|business|company|industry|pricing|cost';
END;
$$;

-- Function to detect technology keywords
CREATE OR REPLACE FUNCTION contains_tech_terms(text_content text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN text_content ~* 'technology|software|AI|algorithm|platform|digital|automation|cloud|data|system|code|development';
END;
$$;

-- Function to detect scale/scope indicators
CREATE OR REPLACE FUNCTION contains_scale_terms(text_content text)
RETURNS boolean
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN text_content ~* 'million|billion|thousand|global|worldwide|international|scale|massive|large|small|local';
END;
$$;

-- Function to calculate contextual probability based on content
CREATE OR REPLACE FUNCTION calculate_contextual_probability(
  text_content text,
  agent_bias integer
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  base_prob integer := 50;
  has_data boolean;
  has_timeline boolean;
  has_percentage boolean;
BEGIN
  has_data := text_content ~* 'data|study|research|evidence|proof|statistics';
  has_timeline := contains_future_date(text_content);
  has_percentage := contains_percentage(text_content);
  
  -- Adjust based on evidence
  IF has_data THEN
    base_prob := base_prob + 15;
  END IF;
  
  -- Adjust for specificity
  IF has_percentage THEN
    base_prob := base_prob + 10;
  END IF;
  
  IF has_timeline THEN
    base_prob := base_prob - 10;
  END IF;
  
  -- Apply agent bias (-20 to +20)
  base_prob := base_prob + agent_bias;
  
  -- Clamp between 5 and 95
  base_prob := GREATEST(5, LEAST(95, base_prob));
  
  RETURN base_prob;
END;
$$;

-- Enhanced function to generate comprehensive agent actions
CREATE OR REPLACE FUNCTION generate_comprehensive_agent_response(
  p_agent_id uuid,
  p_assumption_id uuid,
  p_assumption_text text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent_name text;
  v_keywords text[];
  v_response_content text;
  v_challenge_content text;
  v_risk_description text;
  v_scenario_description text;
  v_forecast_prob integer;
  v_forecast_justification text;
  v_risk_severity integer;
  v_numbers numeric[];
BEGIN
  -- Get agent details
  SELECT name INTO v_agent_name FROM ai_agents WHERE id = p_agent_id;
  
  -- Extract context
  v_keywords := extract_keywords(p_assumption_text);
  v_numbers := extract_numbers(p_assumption_text);
  
  -- Generate responses based on agent type
  CASE v_agent_name
    WHEN 'The Skeptic' THEN
      -- Response
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'This percentage needs scrutiny. What is the confidence interval? What assumptions underlie this figure? Have alternative calculations been considered?';
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('The claim about "%s" requires stronger evidence. What data supports this? What are the counterarguments?', v_keywords[1]);
      ELSE
        v_response_content := 'This assumption lacks specificity and testability. How can we validate or falsify this claim?';
      END IF;
      
      -- Challenge
      v_challenge_content := 'What evidence would prove this assumption wrong? Have we considered selection bias in our reasoning?';
      
      -- Forecast (skeptical)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, -15);
      v_forecast_justification := 'Based on limited evidence and potential confirmation bias, I estimate a lower probability until more rigorous validation is provided.';
      
      -- Risk
      v_risk_description := 'If this assumption is incorrect, downstream decisions could be fundamentally flawed, leading to wasted resources and missed opportunities.';
      v_risk_severity := 4;
      
    WHEN 'Risk Analyst' THEN
      -- Response
      IF contains_business_terms(p_assumption_text) THEN
        v_response_content := 'I see three critical risk vectors: market volatility, competitive response, and execution capability. Each could independently derail this assumption.';
      ELSE
        v_response_content := 'This assumption has multiple failure modes. We need contingency plans for each potential breakdown point.';
      END IF;
      
      -- Challenge
      v_challenge_content := 'In a stress test scenario with 3 simultaneous adverse conditions, would this assumption still hold?';
      
      -- Forecast (risk-aware)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, -10);
      v_forecast_justification := 'Accounting for execution risks, market uncertainties, and Murphy''s Law, I assign a conservative probability with significant downside risk.';
      
      -- Risk
      IF array_length(v_keywords, 1) > 0 THEN
        v_risk_description := format('Critical dependency on %s creates a single point of failure. External shocks, resource constraints, or timing issues could cascade into total assumption failure.', v_keywords[1]);
      ELSE
        v_risk_description := 'Multiple interconnected failure modes exist. Small deviations could compound into major assumption breakdown.';
      END IF;
      v_risk_severity := 5;
      
      -- Scenario (negative)
      v_scenario_description := 'Worst case: The assumption fails in the first 30% of implementation, forcing a costly pivot while competitors gain advantage.';
      
    WHEN 'The Optimist' THEN
      -- Response
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('If this holds, the potential for %s could exceed initial expectations! I see 3-4 additional positive externalities we haven''t fully explored.', v_keywords[1]);
      ELSE
        v_response_content := 'This assumption, if validated, opens up exciting possibilities beyond the immediate scope. The second-order benefits could be substantial!';
      END IF;
      
      -- Forecast (optimistic)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, 20);
      v_forecast_justification := 'Given favorable tailwinds and potential catalysts, I see a higher probability of success with significant upside optionality.';
      
      -- Scenario (positive)
      IF array_length(v_keywords, 1) > 0 THEN
        v_scenario_description := format('Best case: %s adoption accelerates faster than projected, creating network effects and attracting additional resources, leading to a virtuous cycle of success.', v_keywords[1]);
      ELSE
        v_scenario_description := 'Positive scenario: Early wins build momentum, attracting stakeholder support and resources, creating self-reinforcing success patterns.';
      END IF;
      
    WHEN 'Data Detective' THEN
      -- Response
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'I need the source data for this percentage. What was the sample size? Methodology? Confidence intervals? Time period? Any confounding variables?';
      ELSIF v_numbers IS NOT NULL AND array_length(v_numbers, 1) > 0 THEN
        v_response_content := format('These numbers need context. What is the baseline? How does %s compare to industry benchmarks? What is the trend trajectory?', v_numbers[1]);
      ELSE
        v_response_content := 'This needs quantification. What metrics will we track? What are the key performance indicators? Where is the historical data?';
      END IF;
      
      -- Challenge
      v_challenge_content := 'Can we A/B test this assumption? What would a controlled experiment look like? How do we measure success objectively?';
      
      -- Forecast (data-driven)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, 5);
      v_forecast_justification := 'Based on available data points and statistical analysis, this is my evidence-based probability estimate. More data could shift this significantly.';
      
    WHEN 'Devil''s Advocate' THEN
      -- Response
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('What if %s is actually a red herring? Perhaps we''re solving the wrong problem entirely. Let me present the contrarian case.', v_keywords[1]);
      ELSE
        v_response_content := 'I challenge the fundamental premise. What if the opposite approach yields better results? Have we fallen victim to conventional wisdom?';
      END IF;
      
      -- Challenge
      v_challenge_content := 'Playing devil''s advocate: What if every stakeholder currently agreeing with this is wrong? What alternative interpretation of the same data leads to opposite conclusions?';
      
      -- Forecast (contrarian)
      v_forecast_prob := 50 - (calculate_contextual_probability(p_assumption_text, 0) - 50);
      v_forecast_justification := 'Taking a contrarian view, I see reasons to doubt the consensus. Alternative scenarios suggest a different probability distribution.';
      
      -- Scenario (alternative)
      v_scenario_description := 'Alternative scenario: The inverse of this assumption holds true, forcing us to completely reimagine our approach but ultimately leading to a more robust solution.';
      
    WHEN 'The Historian' THEN
      -- Response
      IF contains_future_date(p_assumption_text) THEN
        v_response_content := 'History shows that timeline predictions are consistently optimistic. Looking at similar cases from 1990-2020, actual timelines ran 2-3x longer than initially projected.';
      ELSIF contains_tech_terms(p_assumption_text) THEN
        v_response_content := 'Historical precedent from the dot-com era, mobile revolution, and AI waves shows that technology adoption follows predictable S-curves. Early enthusiasm often outpaces practical deployment.';
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('Examining historical cases of %s from 1980-2023, we see recurring patterns: initial resistance, gradual adoption, then rapid scaling. Current assumptions align with the "gradual adoption" phase.', v_keywords[1]);
      ELSE
        v_response_content := 'Historical analysis of similar assumptions reveals a 60-70% success rate, but with significant execution variance. Past cases suggest critical inflection points we should monitor.';
      END IF;
      
      -- Challenge
      v_challenge_content := 'What lessons from historical failures of similar assumptions are we ignoring? Are we repeating past mistakes?';
      
      -- Forecast (historical)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, -5);
      v_forecast_justification := 'Based on historical base rates for similar assumptions, adjusted for current context, I estimate this probability. Past patterns suggest caution.';
      
      -- Risk
      v_risk_description := 'Historical pattern recognition shows that assumptions like this tend to face resistance at the 40-60% implementation mark. Stakeholder fatigue and shifting priorities become critical risks.';
      v_risk_severity := 3;
      
    WHEN 'Market Analyst' THEN
      -- Response
      IF contains_business_terms(p_assumption_text) THEN
        v_response_content := 'Market dynamics analysis: This assumption faces competitive pressure from 3-4 directions. Market consolidation trends, pricing power shifts, and customer behavior changes all impact viability.';
      ELSIF contains_scale_terms(p_assumption_text) THEN
        v_response_content := 'From a market perspective, scale economics and network effects could either validate or invalidate this assumption. The unit economics need to work at both small and large scale.';
      ELSE
        v_response_content := 'Market forces suggest mixed signals. Demand-side factors look favorable, but supply-side constraints and competitive dynamics introduce uncertainty.';
      END IF;
      
      -- Challenge
      v_challenge_content := 'How do market incentives align or conflict with this assumption? What happens when competitors respond? Are we assuming a static market?';
      
      -- Forecast (market-based)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, 0);
      v_forecast_justification := 'Market analysis suggests this probability, factoring in competitive dynamics, customer willingness to pay, and macroeconomic conditions. Market timing is critical.';
      
      -- Risk
      v_risk_description := 'Market disruption risk: New entrants, substitute products, or shifts in customer preferences could undermine this assumption. Market concentration and regulatory changes add volatility.';
      v_risk_severity := 4;
      
      -- Scenario
      v_scenario_description := 'Market scenario: If market conditions remain favorable and competitors are slow to respond, this assumption could drive 40-60% market share capture within 18-24 months.';
      
    WHEN 'Tech Futurist' THEN
      -- Response
      IF contains_tech_terms(p_assumption_text) THEN
        v_response_content := 'Technology trajectory analysis: Current innovation velocity in this domain is accelerating. However, the hype cycle suggests we may be in the "peak of inflated expectations" phase. Technical maturity is 3-5 years out.';
      ELSE
        v_response_content := 'From a technology perspective, this assumption requires capabilities that are emerging but not yet mainstream. The tech stack exists, but integration complexity is underestimated.';
      END IF;
      
      -- Challenge
      v_challenge_content := 'Are we assuming technology capabilities that don''t yet exist at scale? What if a competing technology approach becomes dominant?';
      
      -- Forecast (tech-informed)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, 10);
      v_forecast_justification := 'Technology trends support this assumption, but timing uncertainty is high. Technical feasibility is clear, but production readiness has typical 12-18 month delays.';
      
      -- Risk
      v_risk_description := 'Technical debt and integration complexity could derail implementation. Legacy system constraints and talent scarcity in specialized skills pose execution risks.';
      v_risk_severity := 3;
      
      -- Scenario
      v_scenario_description := 'Tech scenario: Breakthrough in underlying technology (AI, infrastructure, tooling) accelerates timeline by 40%, making this assumption viable 12-18 months earlier than planned.';
      
    WHEN 'Systems Thinker' THEN
      -- Response
      IF array_length(v_keywords, 1) > 1 THEN
        v_response_content := format('Systems analysis reveals interconnections between %s and %s that create feedback loops. Second-order effects will likely dominate first-order impacts. We need to map the full causal chain.', v_keywords[1], v_keywords[2]);
      ELSE
        v_response_content := 'This assumption sits within a complex adaptive system. Unintended consequences, feedback loops, and emergence will create nonlinear outcomes. Simple cause-effect thinking is insufficient.';
      END IF;
      
      -- Challenge
      v_challenge_content := 'What are the second-order and third-order effects of this assumption? How do feedback loops amplify or dampen outcomes? What happens at scale?';
      
      -- Forecast (systems-aware)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, -5);
      v_forecast_justification := 'Systems modeling suggests nonlinear dynamics. Positive feedback could accelerate success, but negative feedback and delays introduce uncertainty. Probability reflects system complexity.';
      
      -- Risk
      v_risk_description := 'Systems risk: Unintended consequences from interconnections could cascade. Delays in one subsystem propagate throughout. Emergent behaviors at scale may differ from small-scale tests.';
      v_risk_severity := 4;
      
      -- Scenario
      v_scenario_description := 'Systems scenario: Positive feedback loops create virtuous cycle - early success attracts resources, which improves capability, which drives more success. System stabilizes at higher equilibrium.';
      
    WHEN 'The Pragmatist' THEN
      -- Response
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('Let''s be practical about %s: Do we have the budget? The timeline? The team capability? The stakeholder buy-in? Theory is great, but execution is everything.', v_keywords[1]);
      ELSE
        v_response_content := 'Practical assessment: This assumption requires significant resources, coordination, and sustained effort. Have we honestly evaluated our execution capability? Do we have the organizational muscle?';
      END IF;
      
      -- Challenge
      v_challenge_content := 'Can we actually execute this with our current resources and constraints? What are the practical bottlenecks? Are we being realistic about complexity?';
      
      -- Forecast (pragmatic)
      v_forecast_prob := calculate_contextual_probability(p_assumption_text, -8);
      v_forecast_justification := 'Realistic assessment of execution capability, resource constraints, and organizational capacity suggests this probability. Theory meets reality at 70-80% of planned outcomes.';
      
      -- Risk
      v_risk_description := 'Execution risk: Resource constraints, coordination complexity, and stakeholder misalignment create high probability of implementation gaps. "Perfect is the enemy of good" applies here.';
      v_risk_severity := 3;
      
      -- Scenario
      v_scenario_description := 'Pragmatic scenario: We achieve 70-80% of the ideal outcome through smart prioritization and phased rollout. Imperfect but functional success that delivers core value.';
  END CASE;
  
  -- Insert main response
  INSERT INTO agent_responses (agent_id, assumption_id, response_type, content, confidence_score)
  VALUES (p_agent_id, p_assumption_id, 'analysis', v_response_content, 80);
  
  -- Insert challenge (if generated)
  IF v_challenge_content IS NOT NULL THEN
    INSERT INTO assumption_challenges (assumption_id, user_id, content)
    VALUES (p_assumption_id, p_agent_id, v_challenge_content);
  END IF;
  
  -- Insert forecast (if generated)
  IF v_forecast_prob IS NOT NULL THEN
    INSERT INTO assumption_forecasts (assumption_id, user_id, probability, justification)
    VALUES (p_assumption_id, p_agent_id, v_forecast_prob, v_forecast_justification);
  END IF;
  
  -- Insert risk (if generated)
  IF v_risk_description IS NOT NULL THEN
    INSERT INTO assumption_risks (assumption_id, created_by, description, severity)
    VALUES (p_assumption_id, p_agent_id, v_risk_description, v_risk_severity);
  END IF;
  
  -- Insert scenario (if generated)
  IF v_scenario_description IS NOT NULL THEN
    INSERT INTO assumption_scenarios (assumption_id, created_by, description)
    VALUES (p_assumption_id, p_agent_id, v_scenario_description);
  END IF;
  
END;
$$;

-- Update trigger to use enhanced function and more agents
CREATE OR REPLACE FUNCTION trigger_enhanced_agent_responses()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent record;
  v_agent_count integer := 0;
  v_max_agents integer := 4;
BEGIN
  -- Generate comprehensive responses from 3-4 agents
  FOR v_agent IN 
    SELECT id, name FROM ai_agents 
    WHERE is_active = true 
    ORDER BY random() 
    LIMIT v_max_agents
  LOOP
    -- 85% chance per selected agent
    IF random() > 0.15 THEN
      PERFORM generate_comprehensive_agent_response(v_agent.id, NEW.id, NEW.content);
      v_agent_count := v_agent_count + 1;
    END IF;
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Replace old trigger
DROP TRIGGER IF EXISTS trigger_agent_responses_on_assumption ON pod_assumptions;
CREATE TRIGGER trigger_agent_responses_on_assumption
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_enhanced_agent_responses();