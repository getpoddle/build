/*
  # Fix Extract Numbers and Backfill Simple Agent Responses
  
  1. Changes
    - Fix extract_numbers to handle null arrays properly
    - Generate only agent_responses (analysis) for existing assumptions
    - Skip forecasts, challenges, risks, scenarios (require profile FK)
    
  2. Backfill Process
    - 3-4 agents respond to each existing assumption
    - Only analytical responses (no multi-actions for backfill)
    - New assumptions will still get full multi-action responses
*/

-- Fix extract_numbers function to handle nulls properly
CREATE OR REPLACE FUNCTION extract_numbers(text_content text)
RETURNS numeric[]
LANGUAGE plpgsql
AS $$
DECLARE
  numbers numeric[] := '{}';
  num_text text;
BEGIN
  -- Use regexp_matches with 'g' flag, but handle as a set-returning function
  FOR num_text IN 
    SELECT (regexp_matches(text_content, '\d+\.?\d*', 'g'))[1]
  LOOP
    BEGIN
      numbers := array_append(numbers, num_text::numeric);
    EXCEPTION WHEN OTHERS THEN
      -- Skip invalid numbers
      CONTINUE;
    END;
  END LOOP;
  
  RETURN numbers;
END;
$$;

-- Create simplified function for backfill (responses only, no FK constraints)
CREATE OR REPLACE FUNCTION backfill_basic_agent_response(
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
  v_numbers numeric[];
BEGIN
  -- Get agent details
  SELECT name INTO v_agent_name FROM ai_agents WHERE id = p_agent_id;
  
  -- Extract context safely
  v_keywords := COALESCE(extract_keywords(p_assumption_text), ARRAY[]::text[]);
  v_numbers := COALESCE(extract_numbers(p_assumption_text), ARRAY[]::numeric[]);
  
  -- Generate responses based on agent type
  CASE v_agent_name
    WHEN 'The Skeptic' THEN
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'This percentage needs scrutiny. What is the confidence interval? What assumptions underlie this figure? Have alternative calculations been considered?';
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('The claim about "%s" requires stronger evidence. What data supports this? What are the counterarguments?', v_keywords[1]);
      ELSE
        v_response_content := 'This assumption lacks specificity and testability. How can we validate or falsify this claim?';
      END IF;
      
    WHEN 'Risk Analyst' THEN
      IF contains_business_terms(p_assumption_text) THEN
        v_response_content := 'I see three critical risk vectors: market volatility, competitive response, and execution capability. Each could independently derail this assumption.';
      ELSE
        v_response_content := 'This assumption has multiple failure modes. We need contingency plans for each potential breakdown point.';
      END IF;
      
    WHEN 'The Optimist' THEN
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('If this holds, the potential for %s could exceed initial expectations! I see 3-4 additional positive externalities we haven''t fully explored.', v_keywords[1]);
      ELSE
        v_response_content := 'This assumption, if validated, opens up exciting possibilities beyond the immediate scope. The second-order benefits could be substantial!';
      END IF;
      
    WHEN 'Data Detective' THEN
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'I need the source data for this percentage. What was the sample size? Methodology? Confidence intervals? Time period? Any confounding variables?';
      ELSIF v_numbers IS NOT NULL AND array_length(v_numbers, 1) > 0 THEN
        v_response_content := format('These numbers need context. What is the baseline? How does %s compare to industry benchmarks? What is the trend trajectory?', v_numbers[1]);
      ELSE
        v_response_content := 'This needs quantification. What metrics will we track? What are the key performance indicators? Where is the historical data?';
      END IF;
      
    WHEN 'Devil''s Advocate' THEN
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('What if %s is actually a red herring? Perhaps we''re solving the wrong problem entirely. Let me present the contrarian case.', v_keywords[1]);
      ELSE
        v_response_content := 'I challenge the fundamental premise. What if the opposite approach yields better results? Have we fallen victim to conventional wisdom?';
      END IF;
      
    WHEN 'The Historian' THEN
      IF contains_future_date(p_assumption_text) THEN
        v_response_content := 'History shows that timeline predictions are consistently optimistic. Looking at similar cases from 1990-2020, actual timelines ran 2-3x longer than initially projected.';
      ELSIF contains_tech_terms(p_assumption_text) THEN
        v_response_content := 'Historical precedent from the dot-com era, mobile revolution, and AI waves shows that technology adoption follows predictable S-curves. Early enthusiasm often outpaces practical deployment.';
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('Examining historical cases of %s from 1980-2023, we see recurring patterns: initial resistance, gradual adoption, then rapid scaling. Current assumptions align with the "gradual adoption" phase.', v_keywords[1]);
      ELSE
        v_response_content := 'Historical analysis of similar assumptions reveals a 60-70% success rate, but with significant execution variance. Past cases suggest critical inflection points we should monitor.';
      END IF;
      
    WHEN 'Market Analyst' THEN
      IF contains_business_terms(p_assumption_text) THEN
        v_response_content := 'Market dynamics analysis: This assumption faces competitive pressure from 3-4 directions. Market consolidation trends, pricing power shifts, and customer behavior changes all impact viability.';
      ELSIF contains_scale_terms(p_assumption_text) THEN
        v_response_content := 'From a market perspective, scale economics and network effects could either validate or invalidate this assumption. The unit economics need to work at both small and large scale.';
      ELSE
        v_response_content := 'Market forces suggest mixed signals. Demand-side factors look favorable, but supply-side constraints and competitive dynamics introduce uncertainty.';
      END IF;
      
    WHEN 'Tech Futurist' THEN
      IF contains_tech_terms(p_assumption_text) THEN
        v_response_content := 'Technology trajectory analysis: Current innovation velocity in this domain is accelerating. However, the hype cycle suggests we may be in the "peak of inflated expectations" phase. Technical maturity is 3-5 years out.';
      ELSE
        v_response_content := 'From a technology perspective, this assumption requires capabilities that are emerging but not yet mainstream. The tech stack exists, but integration complexity is underestimated.';
      END IF;
      
    WHEN 'Systems Thinker' THEN
      IF array_length(v_keywords, 1) > 1 THEN
        v_response_content := format('Systems analysis reveals interconnections between %s and %s that create feedback loops. Second-order effects will likely dominate first-order impacts. We need to map the full causal chain.', v_keywords[1], v_keywords[2]);
      ELSE
        v_response_content := 'This assumption sits within a complex adaptive system. Unintended consequences, feedback loops, and emergence will create nonlinear outcomes. Simple cause-effect thinking is insufficient.';
      END IF;
      
    WHEN 'The Pragmatist' THEN
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('Let''s be practical about %s: Do we have the budget? The timeline? The team capability? The stakeholder buy-in? Theory is great, but execution is everything.', v_keywords[1]);
      ELSE
        v_response_content := 'Practical assessment: This assumption requires significant resources, coordination, and sustained effort. Have we honestly evaluated our execution capability? Do we have the organizational muscle?';
      END IF;
  END CASE;
  
  -- Insert only the main response
  IF v_response_content IS NOT NULL THEN
    INSERT INTO agent_responses (agent_id, assumption_id, response_type, content, confidence_score)
    VALUES (p_agent_id, p_assumption_id, 'analysis', v_response_content, 80);
  END IF;
  
END;
$$;

-- Backfill function
CREATE OR REPLACE FUNCTION backfill_agent_responses_for_assumption(p_assumption_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agent record;
  v_agent_count integer := 0;
  v_max_agents integer := 4;
  v_assumption_text text;
BEGIN
  SELECT content INTO v_assumption_text FROM pod_assumptions WHERE id = p_assumption_id;
  
  IF v_assumption_text IS NULL THEN
    RETURN;
  END IF;
  
  FOR v_agent IN 
    SELECT id, name FROM ai_agents 
    WHERE is_active = true 
    ORDER BY random() 
    LIMIT v_max_agents
  LOOP
    IF random() > 0.15 THEN
      PERFORM backfill_basic_agent_response(v_agent.id, p_assumption_id, v_assumption_text);
      v_agent_count := v_agent_count + 1;
    END IF;
  END LOOP;
  
END;
$$;

-- Run the backfill
DO $$
DECLARE
  v_assumption record;
  v_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting backfill...';
  
  FOR v_assumption IN 
    SELECT id FROM pod_assumptions 
    WHERE NOT EXISTS (
      SELECT 1 FROM agent_responses ar WHERE ar.assumption_id = pod_assumptions.id
    )
    ORDER BY created_at DESC
  LOOP
    PERFORM backfill_agent_responses_for_assumption(v_assumption.id);
    v_count := v_count + 1;
    
    IF v_count % 5 = 0 THEN
      PERFORM pg_sleep(0.05);
    END IF;
  END LOOP;
  
  RAISE NOTICE 'Complete! Processed % assumptions', v_count;
END;
$$;