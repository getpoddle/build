/*
  # Migrate Existing Assumptions to New Reasoning Entities

  Maps existing pod_assumptions data into the new problems, ideas, and predictions
  tables based on their insight_type category.

  1. Data Mapping
    - insight_type 'Concern'/'Question' -> problems
    - insight_type 'Idea'/'Hypothesis'/'Opportunity' -> ideas
    - insight_type 'Prediction'/'Claim' -> predictions
    - NULL/other -> ideas (default)

  2. Also Migrates
    - agent_predictions -> predictions
    - assumption_challenges -> entity_challenges
    - agent_responses -> entity_agent_responses
    - agent_consensus -> entity_consensus
*/

-- Migrate 'Concern' and 'Question' assumptions to problems
INSERT INTO problems (id, pod_id, created_by, content, domain, status, relevance_score, created_at, updated_at)
SELECT 
  pa.id,
  pa.pod_id,
  pa.created_by,
  pa.content,
  COALESCE(p.domain, ''),
  CASE 
    WHEN ao.outcome = 'confirmed' THEN 'validated'
    WHEN ao.outcome = 'refuted' THEN 'invalidated'
    ELSE 'active'
  END,
  50,
  pa.created_at,
  pa.created_at
FROM pod_assumptions pa
LEFT JOIN pods p ON p.id = pa.pod_id
LEFT JOIN assumption_outcomes ao ON ao.assumption_id = pa.id
WHERE pa.insight_type IN ('Concern', 'Question')
ON CONFLICT (id) DO NOTHING;

-- Migrate 'Idea', 'Hypothesis', 'Opportunity' assumptions to ideas
INSERT INTO ideas (id, pod_id, created_by, content, domain, status, created_at, updated_at)
SELECT 
  pa.id,
  pa.pod_id,
  pa.created_by,
  pa.content,
  COALESCE(p.domain, ''),
  CASE 
    WHEN ao.outcome = 'confirmed' THEN 'validated'
    WHEN ao.outcome = 'refuted' THEN 'invalidated'
    ELSE 'active'
  END,
  pa.created_at,
  pa.created_at
FROM pod_assumptions pa
LEFT JOIN pods p ON p.id = pa.pod_id
LEFT JOIN assumption_outcomes ao ON ao.assumption_id = pa.id
WHERE pa.insight_type IN ('Idea', 'Hypothesis', 'Opportunity')
ON CONFLICT (id) DO NOTHING;

-- Migrate 'Prediction' and 'Claim' assumptions to predictions
INSERT INTO predictions (id, pod_id, created_by, content, domain, status, confidence, outcome, created_at, updated_at)
SELECT 
  pa.id,
  pa.pod_id,
  pa.created_by,
  pa.content,
  COALESCE(p.domain, ''),
  CASE 
    WHEN ao.outcome = 'confirmed' THEN 'validated'
    WHEN ao.outcome = 'refuted' THEN 'invalidated'
    ELSE 'active'
  END,
  COALESCE((SELECT af.probability FROM assumption_forecasts af WHERE af.assumption_id = pa.id LIMIT 1), 50),
  CASE 
    WHEN ao.outcome = 'confirmed' THEN 'correct'
    WHEN ao.outcome = 'refuted' THEN 'wrong'
    ELSE 'pending'
  END,
  pa.created_at,
  pa.created_at
FROM pod_assumptions pa
LEFT JOIN pods p ON p.id = pa.pod_id
LEFT JOIN assumption_outcomes ao ON ao.assumption_id = pa.id
WHERE pa.insight_type IN ('Prediction', 'Claim')
ON CONFLICT (id) DO NOTHING;

-- Migrate remaining assumptions (NULL insight_type or unrecognized) to ideas
INSERT INTO ideas (id, pod_id, created_by, content, domain, status, created_at, updated_at)
SELECT 
  pa.id,
  pa.pod_id,
  pa.created_by,
  pa.content,
  COALESCE(p.domain, ''),
  CASE 
    WHEN ao.outcome = 'confirmed' THEN 'validated'
    WHEN ao.outcome = 'refuted' THEN 'invalidated'
    ELSE 'active'
  END,
  pa.created_at,
  pa.created_at
FROM pod_assumptions pa
LEFT JOIN pods p ON p.id = pa.pod_id
LEFT JOIN assumption_outcomes ao ON ao.assumption_id = pa.id
WHERE pa.insight_type IS NULL 
  OR pa.insight_type NOT IN ('Concern', 'Question', 'Idea', 'Hypothesis', 'Opportunity', 'Prediction', 'Claim')
ON CONFLICT (id) DO NOTHING;

-- Migrate agent_predictions into predictions table
INSERT INTO predictions (id, pod_id, created_by, content, domain, status, confidence, horizon_years, outcome, resolved_at, created_at, updated_at)
SELECT 
  ap.id,
  NULL,
  NULL,
  ap.headline || ': ' || ap.thesis,
  ap.industry,
  CASE 
    WHEN ap.outcome = 'correct' THEN 'validated'
    WHEN ap.outcome = 'wrong' THEN 'invalidated'
    WHEN ap.outcome = 'partial' THEN 'challenged'
    ELSE 'active'
  END,
  ap.confidence,
  ap.horizon_years,
  COALESCE(ap.outcome, 'pending'),
  ap.resolved_at,
  ap.created_at,
  ap.created_at
FROM agent_predictions ap
ON CONFLICT (id) DO NOTHING;

-- Migrate assumption_challenges to entity_challenges
INSERT INTO entity_challenges (id, entity_type, entity_id, user_id, content, created_at)
SELECT 
  ac.id,
  CASE 
    WHEN pa.insight_type IN ('Concern', 'Question') THEN 'problem'
    WHEN pa.insight_type IN ('Prediction', 'Claim') THEN 'prediction'
    ELSE 'idea'
  END,
  ac.assumption_id,
  ac.user_id,
  ac.content,
  ac.created_at
FROM assumption_challenges ac
JOIN pod_assumptions pa ON pa.id = ac.assumption_id
ON CONFLICT (id) DO NOTHING;

-- Migrate agent_responses to entity_agent_responses
INSERT INTO entity_agent_responses (id, entity_type, entity_id, agent_role, response_type, content, confidence_score, reference_links, created_at)
SELECT 
  ar.id,
  CASE 
    WHEN pa.insight_type IN ('Concern', 'Question') THEN 'problem'
    WHEN pa.insight_type IN ('Prediction', 'Claim') THEN 'prediction'
    ELSE 'idea'
  END,
  ar.assumption_id,
  COALESCE(ar.display_name, 'Analyst'),
  ar.response_type,
  ar.content,
  ar.confidence_score,
  COALESCE(ar.reference_links, '[]'::jsonb),
  ar.created_at
FROM agent_responses ar
JOIN pod_assumptions pa ON pa.id = ar.assumption_id
ON CONFLICT (id) DO NOTHING;

-- Migrate agent_consensus to entity_consensus
INSERT INTO entity_consensus (id, entity_type, entity_id, verdict, confidence_score, summary, key_points, positions, agent_count, created_at, updated_at)
SELECT 
  ac.id,
  CASE 
    WHEN pa.insight_type IN ('Concern', 'Question') THEN 'problem'
    WHEN pa.insight_type IN ('Prediction', 'Claim') THEN 'prediction'
    ELSE 'idea'
  END,
  ac.assumption_id,
  ac.verdict,
  ac.confidence_score,
  ac.summary,
  ac.key_points,
  COALESCE(ac.positions, '[]'::jsonb),
  ac.agent_count,
  ac.created_at,
  ac.updated_at
FROM agent_consensus ac
JOIN pod_assumptions pa ON pa.id = ac.assumption_id
ON CONFLICT (id) DO NOTHING;