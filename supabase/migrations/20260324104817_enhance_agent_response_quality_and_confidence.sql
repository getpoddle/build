/*
  # Enhance Agent Response Quality and Confidence Scores
  
  1. Changes
    - Replace generic 80% confidence with realistic, varied scores
    - Improve response specificity and human-like quality
    - Add more contextual, less templated responses
    - Make agents sound like real experts, not bots
*/

-- Update the comprehensive agent response generator with better responses and confidence
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
  v_numbers numeric[];
  v_has_numbers boolean;
  v_has_business_terms boolean;
  v_has_tech_terms boolean;
  v_response_content text;
  v_confidence integer;
  v_forecast_probability integer;
  v_forecast_content text;
  v_challenge_content text;
  v_risk_content text;
  v_risk_severity integer;
  v_scenario_content text;
  v_scenario_type text;
BEGIN
  -- Get agent details
  SELECT name INTO v_agent_name FROM ai_agents WHERE id = p_agent_id;
  
  -- Extract context
  v_keywords := COALESCE(extract_keywords(p_assumption_text), ARRAY[]::text[]);
  v_numbers := COALESCE(extract_numbers(p_assumption_text), ARRAY[]::numeric[]);
  v_has_numbers := array_length(v_numbers, 1) > 0;
  v_has_business_terms := contains_business_terms(p_assumption_text);
  v_has_tech_terms := contains_tech_terms(p_assumption_text);
  
  -- Calculate realistic confidence
  v_confidence := calculate_realistic_confidence(
    v_agent_name,
    p_assumption_text,
    v_has_numbers,
    array_length(v_keywords, 1) > 2
  );
  
  -- Generate more human-like, specific responses per agent
  CASE v_agent_name
    WHEN 'The Skeptic' THEN
      IF contains_percentage(p_assumption_text) THEN
        v_response_content := 'Hold on - this percentage bothers me. Where did it come from? Was it a survey with self-selected respondents? A model with questionable assumptions? I''ve seen too many confident numbers that fall apart under scrutiny. We need the methodology, sample size, and confidence intervals before treating this as gospel.';
        v_confidence := 76;
      ELSIF v_has_numbers THEN
        v_response_content := format('These numbers look suspiciously round - %s feels like a back-of-envelope estimate rather than rigorous analysis. What''s the margin of error? What assumptions are baked in? I''d want to see sensitivity analysis before betting on these figures.', v_numbers[1]);
        v_confidence := 68;
      ELSIF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('The framing around "%s" concerns me. It''s presented as self-evident, but is it? I can think of 3-4 counterexamples off the top of my head where similar logic failed. What makes this case different? We''re substituting narrative for evidence here.', v_keywords[1]);
        v_confidence := 71;
      ELSE
        v_response_content := 'This reads more like aspiration than assumption. Where''s the falsifiability? How would we know if we''re wrong? Without clear success criteria, we''re just hoping for the best and calling it strategy. That''s not rigorous thinking - it''s wishful thinking with extra steps.';
        v_confidence := 73;
      END IF;
      
      -- Skeptic challenges and forecasts
      v_challenge_content := 'What evidence would convince you this assumption is wrong? If you can''t articulate that, you''re not making a testable claim - you''re stating a belief. Scientific thinking requires falsifiability.';
      v_forecast_probability := 35 + (random() * 20)::integer; -- 35-55%
      v_forecast_content := format('Given the lack of strong supporting evidence, I''d put this at %s%% probability at best. The burden of proof hasn''t been met, and extraordinary claims require extraordinary evidence.', v_forecast_probability);
      v_risk_content := 'Confirmation bias is the primary risk here. We''re likely to interpret ambiguous signals as supporting evidence while dismissing contradictions. This leads to doubling down on flawed assumptions until reality forces a painful correction.';
      v_risk_severity := 4;
      
    WHEN 'Risk Analyst' THEN
      IF v_has_business_terms THEN
        v_response_content := 'Three risk vectors immediately stand out: (1) market timing - are we early, late, or catastrophically mistimed? (2) competitive response - incumbents won''t sit idle, (3) execution risk - ideas are cheap, implementation is expensive. Any one of these could sink this, and they''re not independent risks.';
        v_confidence := 72;
      ELSIF v_has_tech_terms THEN
        v_response_content := 'The technology risk stack is concerning: infrastructure dependencies, integration complexity, technical debt accumulation, and the ever-present security vulnerability surface. Plus, tech ages in dog years - what''s cutting edge today is legacy tomorrow. Are we building for 2026 or 2030?';
        v_confidence := 67;
      ELSE
        v_response_content := 'Let me paint the failure scenarios: optimistic timeline meets reality, key person dependency materializes at worst time, or regulatory environment shifts unexpectedly. I''ve seen projects with better assumptions fail on execution. What''s our margin for error? Because it''s smaller than you think.';
        v_confidence := 70;
      END IF;
      
      v_risk_content := 'Worst-case scenario: cascading failures where one setback triggers others. Think 2008 financial crisis - it wasn''t one risk, it was risk correlation nobody modeled. We need stress testing across multiple simultaneous failure modes.';
      v_risk_severity := 4;
      v_scenario_content := 'Downside scenario: First deadline slips, then team morale drops, then key people leave, then quality suffers, then customers notice, then reputation damage makes recovery harder. This doom loop is frighteningly common.';
      v_scenario_type := 'negative';
      
    WHEN 'The Optimist' THEN
      IF array_length(v_keywords, 1) > 0 THEN
        v_response_content := format('Here''s what excites me about %s: the second-order effects nobody is pricing in yet. If this works, we''re not just solving one problem - we''re creating a platform for solving related problems we haven''t even identified. The upside optionality is massive.', v_keywords[1]);
        v_confidence := 84;
      ELSE
        v_response_content := 'Look, everyone is focused on the risks and challenges. But breakthrough innovations always looked impossible until they weren''t. The Wright brothers, internet, smartphones - all "unrealistic" until they changed everything. The asymmetric upside here is underappreciated.';
        v_confidence := 79;
      END IF;
      
      v_forecast_probability := 65 + (random() * 25)::integer; -- 65-90%
      v_forecast_content := format('I''m at %s%% confidence this works out, maybe even exceeds expectations. The fundamentals are sound, the timing feels right, and the people involved are capable. Sometimes you have to trust the setup even when you can''t see the full path.', v_forecast_probability);
      v_scenario_content := 'Best-case scenario: This becomes the reference implementation everyone copies. Network effects kick in faster than projected, creating a moat that compounds over time. Five years from now, we''ll wonder how we ever did it the old way.';
      v_scenario_type := 'positive';
      
    WHEN 'Data Detective' THEN
      IF v_has_numbers THEN
        v_response_content := format('Let''s talk about these numbers. %s compared to what? What''s the baseline? The comparison group? The measurement methodology? I need the full statistical context - means, medians, standard deviations, outliers. One number in isolation tells me nothing.', v_numbers[1]);
        v_confidence := 86;
      ELSIF contains_percentage(p_assumption_text) THEN
        v_response_content := 'A percentage without context is meaningless. Was this from a representative sample or convenience sampling? What was the response rate? How was the question framed (because that matters enormously)? What was the confidence interval? Without this, we''re just trusting vibes over data.';
        v_confidence := 48; -- Low confidence when data is missing
      ELSE
        v_response_content := 'This needs to be quantified before we can evaluate it properly. What are the KPIs? What''s the measurement cadence? What data sources are we using? Vague assumptions lead to vague outcomes. Let''s get specific about what good looks like, numerically.';
        v_confidence := 42; -- Very low confidence without data
      END IF;
      
      v_challenge_content := 'Show me the data. Not anecdotes, not "we believe", not "experts say" - show me reproducible analysis with clear methodology. If the data doesn''t exist yet, that''s fine, but let''s be honest that we''re making educated guesses, not data-driven decisions.';
      
    WHEN 'The Historian' THEN
      IF v_has_tech_terms THEN
        v_response_content := 'I''ve seen this movie before. The 1990s internet boom, 2010s mobile revolution, now AI wave - the pattern is identical. Early hype, winter of disappointment, then steady practical progress that exceeds initial hype. We''re probably in the hype phase. Real impact comes in 5-10 years, not 1-2.';
        v_confidence := 77;
      ELSIF contains_future_date(p_assumption_text) THEN
        v_response_content := 'Timeline prediction is where history offers brutal lessons. The Sydney Opera House: 4 years planned, 14 years actual. The Big Dig: 6 years estimated, 16 years real. Consistent pattern: optimistic timelines meet reality, then double the estimate and add some. Hofstadter''s Law is undefeated.';
        v_confidence := 81;
      ELSE
        v_response_content := 'Looking at similar cases from the past 40 years: initial excitement, trough of disillusionment (usually 18-24 months in), then slow climb to actual adoption. Current assumption feels like we''re in the excitement phase. Historical base rates suggest tempering expectations.';
        v_confidence := 75;
      END IF;
      
    WHEN 'Market Analyst' THEN
      v_response_content := 'Market dynamics analysis: we''re in a weird spot. Tailwinds from macro trends, but headwinds from competitive intensity and pricing pressure. The unit economics look okay on paper, but paper doesn''t include messy reality like customer acquisition costs creeping up and retention rates disappointing. Markets are ruthlessly efficient at punishing optimistic assumptions.';
      v_confidence := 69;
      
      v_forecast_probability := 45 + (random() * 30)::integer; -- 45-75%
      v_forecast_content := 'Markets are coin-flip machines with better branding. I''d say %s%% this plays out as hoped, but market timing is everything. Being right too early is indistinguishable from being wrong. And being wrong at scale is expensive.';
      
    WHEN 'Tech Futurist' THEN
      v_response_content := 'Technology trajectory says we''re in the hype cycle peak right now. The tech is real, but implementation complexity is underestimated. I''ve seen bleeding-edge become legacy before it scales. Plus, technology evolves faster than organizations adapt. We might build for 2026 tech when 2028 tech makes it obsolete.';
      v_confidence := 59; -- Future is uncertain
      
    WHEN 'Systems Thinker' THEN
      v_response_content := 'This assumption exists in a complex adaptive system with feedback loops we''re not mapping. Change one variable, and three others shift in unexpected ways. Linear thinking in nonlinear systems is how we get surprised by "unforeseeable" consequences that were actually quite foreseeable with better systems modeling.';
      v_confidence := 63;
      
    WHEN 'The Pragmatist' THEN
      v_response_content := 'Let''s get practical: Do we have the budget? The people? The timeline? The stakeholder buy-in? Because I''ve seen perfect strategies die on the rocks of inadequate resources. Theory is beautiful, but execution is where dreams meet reality. And reality has a perfect track record against beautiful theories with poor execution.';
      v_confidence := 74;
  END CASE;
  
  -- Insert main response
  IF v_response_content IS NOT NULL THEN
    INSERT INTO agent_responses (agent_id, assumption_id, response_type, content, confidence_score)
    VALUES (p_agent_id, p_assumption_id, 'analysis', v_response_content, v_confidence);
  END IF;
  
END;
$$;