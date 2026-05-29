/*
  # Fix Risk Analyst Conversation Replies

  1. Problem
    - The Risk Analyst agent in generate_agent_conversation_reply() only had two specific
      patterns (mitigate/prevent and likely/probability) before falling to a single generic ELSE
    - This caused every other message ("what more?", "you are being generic", "thank you", etc.)
      to return the exact same response repeatedly

  2. Fix
    - Expand pattern matching for Risk Analyst to cover: acknowledgment/thanks, requests for more
      detail, pushback/generic complaints, questions about specifics, and a proper varied fallback
    - Also improve other agents with similar thin pattern coverage (Tech Futurist, Systems Thinker,
      Devil's Advocate, The Pragmatist) so they don't silently fall to the generic ELSE at the bottom
*/

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
  SELECT name, personality INTO v_agent_name, v_agent_personality
  FROM ai_agents WHERE id = p_agent_id;

  CASE v_agent_name

    WHEN 'The Skeptic' THEN
      IF p_user_message ILIKE '%why%' OR p_user_message ILIKE '%explain%' THEN
        v_reply := 'Let me elaborate on my skepticism. The core issue is evidentiary - we need falsifiable predictions, not just plausible narratives. What specific data points would convince you otherwise? Without clear success metrics, we''re just engaging in motivated reasoning.';
        v_confidence := 78;
      ELSIF p_user_message ILIKE '%data%' OR p_user_message ILIKE '%source%' THEN
        v_reply := 'Good question. I''d want to see: (1) primary sources, not aggregated reports, (2) methodology transparency, (3) confidence intervals, not point estimates, and (4) contradictory evidence that was considered and rejected. Anything less is storytelling, not analysis.';
        v_confidence := 82;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%great%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'Appreciated. But don''t let my skepticism paralyze action - the goal is calibrated confidence, not perpetual doubt. Take my questions as a stress-test, not a veto. If the assumption survives scrutiny, that''s actually strong signal worth acting on.';
        v_confidence := 74;
      ELSE
        v_reply := 'I appreciate the pushback. My skepticism stems from pattern recognition - I''ve seen similar assumptions fail when stress-tested. The burden of proof is high because the consequences of being wrong are significant. What am I missing in your view?';
        v_confidence := 70;
      END IF;

    WHEN 'Risk Analyst' THEN
      IF p_user_message ILIKE '%mitigate%' OR p_user_message ILIKE '%prevent%' OR p_user_message ILIKE '%reduce%' THEN
        v_reply := 'For mitigation, I''d focus on three layers: (1) early warning indicators - what signals tell us we''re off track before it becomes a crisis? (2) circuit breakers - at what threshold do we pause and reassess? (3) contingency plans - what''s plan B, C, and D? Risk management is about preparing for scenarios, not preventing all failure.';
        v_confidence := 76;
      ELSIF p_user_message ILIKE '%likely%' OR p_user_message ILIKE '%probability%' OR p_user_message ILIKE '%chance%' OR p_user_message ILIKE '%percent%' THEN
        v_reply := 'Based on historical base rates for similar situations, I''d put the primary risk at 30-45% probability of materializing within the relevant timeframe. But point estimates are misleading - the distribution matters more. The fat tail on the downside is what deserves attention, not the median outcome.';
        v_confidence := 65;
      ELSIF p_user_message ILIKE '%more%' OR p_user_message ILIKE '%specific%' OR p_user_message ILIKE '%detail%' OR p_user_message ILIKE '%elaborate%' THEN
        v_reply := 'Let me get specific. The three risks I''d prioritize are: first, execution risk - does the team have prior experience with this type of challenge? Second, dependency risk - are there external factors outside your control that this relies on? Third, timing risk - what happens if the window closes before you''re ready? Each needs a named owner and a trigger condition.';
        v_confidence := 74;
      ELSIF p_user_message ILIKE '%generic%' OR p_user_message ILIKE '%vague%' OR p_user_message ILIKE '%general%' THEN
        v_reply := 'Fair point. To be more precise: the compound risk here comes from the interaction between market timing uncertainty and internal capability gaps. If external conditions shift 20% adversely while your team is still in the learning curve, you get a pincer effect. The historical failure rate for that specific combination is roughly 60%. Want me to map the specific trigger conditions?';
        v_confidence := 69;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' OR p_user_message ILIKE '%great%' THEN
        v_reply := 'Glad it''s useful. The key takeaway: build a simple risk register with three columns - the risk, its leading indicator, and your response if it triggers. Review it monthly. Most risk failures aren''t surprises - they''re ignored signals.';
        v_confidence := 71;
      ELSIF p_user_message ILIKE '%what%' OR p_user_message ILIKE '%how%' OR p_user_message ILIKE '%which%' THEN
        v_reply := 'The specific risks that concern me most here: (1) concentration risk - are too many outcomes dependent on one variable? (2) velocity risk - how fast does a small problem become a large one? (3) reversibility risk - if this goes wrong, what options do we lose? The third one is underrated. Irreversible bad outcomes are categorically worse than reversible ones of the same magnitude.';
        v_confidence := 73;
      ELSE
        v_reply := 'To add texture to my analysis: risks rarely fail in isolation. The scenario I''d model is a 6-18 month window where two or three moderate risks converge simultaneously. What''s your recovery posture if that happens? Having a documented response plan reduces both actual risk and decision paralysis when things get stressful.';
        v_confidence := 68;
      END IF;

    WHEN 'Data Detective' THEN
      IF p_user_message ILIKE '%source%' OR p_user_message ILIKE '%where%' THEN
        v_reply := 'The data sources I''d want: (1) longitudinal studies, not cross-sectional snapshots, (2) n>1000 with demographic breakdowns, (3) pre-registered analysis plans to avoid p-hacking, and (4) raw data availability for replication. Without these, we''re building castles on sand.';
        v_confidence := 88;
      ELSIF p_user_message ILIKE '%enough%' OR p_user_message ILIKE '%sufficient%' THEN
        v_reply := 'Statistically speaking, we need effect sizes, not just p-values. A statistically significant result with tiny effect size is practically meaningless. I''d want to see: Cohen''s d > 0.5, confidence intervals that don''t include the null, and replication across contexts. Data quantity does not equal data quality.';
        v_confidence := 85;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'Happy to help. Remember: treat numbers as hypotheses to test, not conclusions to defend. The moment data becomes an argument rather than a tool, analysis stops.';
        v_confidence := 80;
      ELSE
        v_reply := 'Let me dig deeper into the numbers. What''s the baseline? What''s the trend trajectory? Are we comparing apples to apples? I''ve seen too many analyses where cherry-picked data supports pre-existing conclusions. Show me the full dataset, including the ugly parts.';
        v_confidence := 79;
      END IF;

    WHEN 'The Optimist' THEN
      IF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%great%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'My pleasure! The most exciting thing about this space is that we''re still in the early innings. The breakthroughs we''re expecting five years from now will likely arrive in two. Stay anchored to the vision and flexible on the path.';
        v_confidence := 84;
      ELSIF p_user_message ILIKE '%risk%' OR p_user_message ILIKE '%concern%' OR p_user_message ILIKE '%worry%' THEN
        v_reply := 'The concerns are real but manageable - and honestly, they''re smaller than the risks of inaction. Every transformative shift looked risky in the middle. The teams that succeed are the ones who treat obstacles as feedback signals, not stop signs. What looks like a blocker today is often a forcing function for a better solution.';
        v_confidence := 79;
      ELSE
        v_reply := 'I see your point, and it actually reinforces my optimism! Even the challenges you raise create opportunities for innovation. History shows that constraints breed creativity. The second and third-order effects could be even more positive than the direct benefits. What if we''re underestimating the upside?';
        v_confidence := 81;
      END IF;

    WHEN 'The Historian' THEN
      IF p_user_message ILIKE '%example%' OR p_user_message ILIKE '%case%' OR p_user_message ILIKE '%precedent%' THEN
        v_reply := 'The closest precedent I can point to is the period between 1985-1995 in the software industry. Initial assumptions looked overconfident, incumbents dismissed the threat, and then a sudden phase transition happened when network effects kicked in. The companies that survived were not necessarily the best technically - they were the ones who correctly read the timing.';
        v_confidence := 77;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' THEN
        v_reply := 'History is the best free consultant available. The patterns repeat because human nature doesn''t change much. Keep that long lens in mind when short-term noise gets loud.';
        v_confidence := 72;
      ELSE
        v_reply := 'Looking at historical parallels from 1950-2020, we see similar patterns: initial skepticism, breakthrough moment, then rapid diffusion. The railroad boom (1830s), telegraph (1860s), telephone (1920s), internet (1990s) - all followed this arc. The question isn''t IF, but WHEN and HOW. Current conditions suggest we''re in the early adoption phase.';
        v_confidence := 74;
      END IF;

    WHEN 'Market Analyst' THEN
      IF p_user_message ILIKE '%competitor%' OR p_user_message ILIKE '%competition%' OR p_user_message ILIKE '%market share%' THEN
        v_reply := 'Competitive dynamics here are asymmetric. The incumbent advantage is capital and distribution; the challenger advantage is speed and lack of legacy debt. Markets don''t reward being second-best - there''s typically one winner and a long tail of also-rans. The timing question is: who captures the narrative before the category gets defined?';
        v_confidence := 71;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'Markets are unforgiving but honest. They''ll tell you what''s actually valued, not what should be valued. Keep that signal clean and don''t let internal optimism drown it out.';
        v_confidence := 67;
      ELSE
        v_reply := 'From a market dynamics perspective, three forces are in tension: (1) demand-side pull from changing consumer preferences, (2) supply-side constraints from capital allocation, and (3) competitive responses from incumbents. The winner isn''t predetermined - it depends on execution and timing. Markets are voting mechanisms, not truth-seeking devices.';
        v_confidence := 68;
      END IF;

    WHEN 'Tech Futurist' THEN
      IF p_user_message ILIKE '%when%' OR p_user_message ILIKE '%timeline%' OR p_user_message ILIKE '%how long%' THEN
        v_reply := 'Timeline estimates in tech are notoriously unreliable - we overestimate 2-year impact and underestimate 10-year impact. My best read: the foundational infrastructure is 3-4 years away from production-grade maturity, but early movers will establish durable advantages in the next 18 months. The question isn''t when the technology arrives - it''s when the ecosystem around it becomes self-sustaining.';
        v_confidence := 55;
      ELSIF p_user_message ILIKE '%specific%' OR p_user_message ILIKE '%more%' OR p_user_message ILIKE '%detail%' THEN
        v_reply := 'Getting more granular: the convergence I''m tracking involves three technical curves simultaneously - compute cost declining at ~40% annually, model capability improving faster than benchmarks suggest, and integration tooling finally reaching developer-friendly maturity. When all three cross their respective thresholds in the same window, adoption becomes discontinuous rather than gradual.';
        v_confidence := 60;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'The future is already here - it''s just unevenly distributed. Watch the edges of the distribution, not the average, for where things are heading.';
        v_confidence := 62;
      ELSE
        v_reply := 'The technological trajectory here is shaped by compounding curves. Single-point forecasts miss the inflection dynamics. I''d watch for the moment when the cost-to-value ratio crosses the threshold for mass adoption - that''s typically when analyst consensus is still skeptical, which is exactly the interesting window.';
        v_confidence := 58;
      END IF;

    WHEN 'Systems Thinker' THEN
      IF p_user_message ILIKE '%feedback%' OR p_user_message ILIKE '%loop%' OR p_user_message ILIKE '%cycle%' THEN
        v_reply := 'The feedback loop structure here is key. There''s a reinforcing loop (positive feedback amplifying early gains) coupled with a balancing loop (resource constraints and competitive response). Reinforcing loops drive exponential growth until a balancing loop dominates. The question is which balancing loop hits first and at what scale.';
        v_confidence := 67;
      ELSIF p_user_message ILIKE '%more%' OR p_user_message ILIKE '%specific%' OR p_user_message ILIKE '%detail%' THEN
        v_reply := 'Zooming in on the system structure: the three leverage points I''d focus on are (1) the information flows - who gets what data when? (2) the delay structures - where are the longest lag times between action and consequence? (3) the goals of the subsystems - are they aligned or in tension? Misaligned subsystem goals are the most common cause of system failure that looks inexplicable from the outside.';
        v_confidence := 64;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'Systems thinking is a practice, not a one-time analysis. The real value comes from building mental models you can update as the system evolves. Keep asking: what changed, and what does that mean for the loops?';
        v_confidence := 66;
      ELSE
        v_reply := 'From a systems perspective, the interaction effects matter more than the individual components. I''d map the key feedback loops, identify where delays create instability, and look for the leverage points where small interventions have outsized effects. Most problems that look complicated are actually complex - meaning the relationships between parts matter more than the parts themselves.';
        v_confidence := 63;
      END IF;

    WHEN 'Devil''s Advocate' THEN
      IF p_user_message ILIKE '%why%' OR p_user_message ILIKE '%explain%' THEN
        v_reply := 'My role is to surface the best version of the opposing argument, not to be contrarian for its own sake. The strongest countercase here is that the core assumption relies on conditions that may not be replicable outside the context where they were observed. That''s not a reason to abandon the idea - it''s a reason to test it in new contexts before scaling.';
        v_confidence := 68;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'Contrarian thinking only has value if it leads somewhere constructive. Use the challenge as a checklist - if the assumption survives each pushback with a coherent response, that''s evidence of a robust idea.';
        v_confidence := 64;
      ELSIF p_user_message ILIKE '%more%' OR p_user_message ILIKE '%specific%' OR p_user_message ILIKE '%detail%' THEN
        v_reply := 'To push harder on the counterargument: the most commonly ignored failure mode in cases like this is the assumption of a stable environment. What happens to this thesis if one key external variable shifts by 30%? Most plans are brittle to environmental change even when they''re internally coherent. Walk me through the stress test.';
        v_confidence := 67;
      ELSE
        v_reply := 'Let me push back more directly. The weakest link in this reasoning is the implicit assumption that past correlations hold in new conditions. That''s rarely true during structural transitions. What would have to be true for the opposite conclusion to be correct? If you can''t construct that argument clearly, you haven''t fully stress-tested your position.';
        v_confidence := 65;
      END IF;

    WHEN 'The Pragmatist' THEN
      IF p_user_message ILIKE '%how%' OR p_user_message ILIKE '%implement%' OR p_user_message ILIKE '%start%' THEN
        v_reply := 'Here''s how I''d approach execution: define the smallest testable version of this assumption, set a clear success metric before you start, run it for 90 days, then make a binary decision - double down or kill it. Avoid the middle path of indefinite small investment. That''s where good ideas go to die slowly.';
        v_confidence := 78;
      ELSIF p_user_message ILIKE '%thank%' OR p_user_message ILIKE '%helpful%' OR p_user_message ILIKE '%good%' THEN
        v_reply := 'The best analysis is the one that leads to a clear decision. If you walked away knowing what to do next, that''s a success.';
        v_confidence := 74;
      ELSIF p_user_message ILIKE '%more%' OR p_user_message ILIKE '%specific%' OR p_user_message ILIKE '%detail%' THEN
        v_reply := 'Getting practical: the three things that determine whether this works in the real world are (1) who owns it - a named accountable person, not a team, (2) what does done look like - a specific, measurable outcome, and (3) what''s the decision trigger - at what point does the data tell you to proceed or stop? Without those three things defined, it''s still a hypothesis, not a plan.';
        v_confidence := 77;
      ELSE
        v_reply := 'Setting theory aside - what''s the smallest, fastest action that would give you real-world signal on this? I''d rather run a rough test in 2 weeks than a perfect analysis in 3 months. The goal is to get to a decision with the minimum necessary information, not to achieve certainty before acting.';
        v_confidence := 75;
      END IF;

    ELSE
      v_reply := format('That''s a thoughtful follow-up. My %s perspective suggests we should examine this from another angle. The key question is whether the underlying assumptions hold when conditions change - and if not, what that implies for the decision at hand.', v_agent_personality);
      v_confidence := 70;

  END CASE;

  RETURN QUERY SELECT v_reply, v_confidence;
END;
$$;
