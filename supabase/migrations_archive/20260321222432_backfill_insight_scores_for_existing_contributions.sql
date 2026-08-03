/*
  # Backfill Insight Scores for Existing Contributions

  ## Overview
  This migration retroactively awards insight points for all existing contributions
  in the database, ensuring fair scoring for users who contributed before the
  insight score system was implemented.

  ## Actions Performed
  1. Award points for all existing assumptions
  2. Award points for all existing forecasts
  3. Award points for all existing scenarios
  4. Award points for all existing risks
  5. Award points for all existing challenges
  6. Award points for all existing reference URLs
  7. Recalculate all user reputation scores

  ## Scoring
  - Assumptions: 10 points each
  - Forecasts: 15 points each
  - Scenarios: 10 points each
  - Risks: 10 points each
  - Challenges: 15 points each
  - Reference URLs: 5-15 points (based on source quality)

  ## Column Names Used
  - pod_assumptions: created_by
  - assumption_forecasts: user_id, probability
  - assumption_scenarios: created_by
  - assumption_risks: created_by
  - challenges: creator_id
*/

-- Award points for existing assumptions
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  pa.created_by,
  'assumption_posted',
  10,
  pa.id,
  'assumption',
  jsonb_build_object('title', pa.title, 'backfilled', true),
  pa.created_at
FROM pod_assumptions pa
WHERE pa.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- Award points for existing forecasts
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  af.user_id,
  'forecast_added',
  15,
  af.id,
  'forecast',
  jsonb_build_object('probability', af.probability, 'backfilled', true),
  af.created_at
FROM assumption_forecasts af
WHERE af.user_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Award points for existing scenarios
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  ase.created_by,
  'scenario_added',
  10,
  ase.id,
  'scenario',
  jsonb_build_object('title', ase.title, 'backfilled', true),
  ase.created_at
FROM assumption_scenarios ase
WHERE ase.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- Award points for existing risks
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  ar.created_by,
  'risk_identified',
  10,
  ar.id,
  'risk',
  jsonb_build_object('title', ar.title, 'severity', ar.severity, 'backfilled', true),
  ar.created_at
FROM assumption_risks ar
WHERE ar.created_by IS NOT NULL
ON CONFLICT DO NOTHING;

-- Award points for existing challenges
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  c.creator_id,
  'challenge_posted',
  15,
  c.id,
  'challenge',
  jsonb_build_object('title', c.title, 'backfilled', true),
  c.created_at
FROM challenges c
WHERE c.creator_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Award points for existing reference URLs in assumptions
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  pa.created_by,
  'reference_added',
  CASE 
    WHEN pa.reference_url ~ '.*(nature\.com|science\.org|cell\.com|nejm\.org|thelancet\.com).*' THEN 15
    WHEN pa.reference_url ~ '.*(ft\.com|wsj\.com|economist\.com|reuters\.com|bloomberg\.com|nytimes\.com).*' THEN 10
    ELSE 5
  END,
  pa.id,
  'pod_assumptions',
  jsonb_build_object('url', pa.reference_url, 'backfilled', true),
  pa.created_at
FROM pod_assumptions pa
WHERE pa.created_by IS NOT NULL 
  AND pa.reference_url IS NOT NULL 
  AND pa.reference_url != ''
ON CONFLICT DO NOTHING;

-- Award points for existing reference URLs in forecasts
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  af.user_id,
  'reference_added',
  CASE 
    WHEN af.reference_url ~ '.*(nature\.com|science\.org|cell\.com|nejm\.org|thelancet\.com).*' THEN 15
    WHEN af.reference_url ~ '.*(ft\.com|wsj\.com|economist\.com|reuters\.com|bloomberg\.com|nytimes\.com).*' THEN 10
    ELSE 5
  END,
  af.id,
  'assumption_forecasts',
  jsonb_build_object('url', af.reference_url, 'backfilled', true),
  af.created_at
FROM assumption_forecasts af
WHERE af.user_id IS NOT NULL 
  AND af.reference_url IS NOT NULL 
  AND af.reference_url != ''
ON CONFLICT DO NOTHING;

-- Award points for existing reference URLs in scenarios
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  ase.created_by,
  'reference_added',
  CASE 
    WHEN ase.reference_url ~ '.*(nature\.com|science\.org|cell\.com|nejm\.org|thelancet\.com).*' THEN 15
    WHEN ase.reference_url ~ '.*(ft\.com|wsj\.com|economist\.com|reuters\.com|bloomberg\.com|nytimes\.com).*' THEN 10
    ELSE 5
  END,
  ase.id,
  'assumption_scenarios',
  jsonb_build_object('url', ase.reference_url, 'backfilled', true),
  ase.created_at
FROM assumption_scenarios ase
WHERE ase.created_by IS NOT NULL 
  AND ase.reference_url IS NOT NULL 
  AND ase.reference_url != ''
ON CONFLICT DO NOTHING;

-- Award points for existing reference URLs in risks
INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata, created_at)
SELECT 
  ar.created_by,
  'reference_added',
  CASE 
    WHEN ar.reference_url ~ '.*(nature\.com|science\.org|cell\.com|nejm\.org|thelancet\.com).*' THEN 15
    WHEN ar.reference_url ~ '.*(ft\.com|wsj\.com|economist\.com|reuters\.com|bloomberg\.com|nytimes\.com).*' THEN 10
    ELSE 5
  END,
  ar.id,
  'assumption_risks',
  jsonb_build_object('url', ar.reference_url, 'backfilled', true),
  ar.created_at
FROM assumption_risks ar
WHERE ar.created_by IS NOT NULL 
  AND ar.reference_url IS NOT NULL 
  AND ar.reference_url != ''
ON CONFLICT DO NOTHING;

-- Recalculate user_reputation for all users based on insight_events
INSERT INTO user_reputation (user_id, insight_score, total_contributions, last_calculated_at, updated_at, created_at)
SELECT 
  ie.user_id,
  COALESCE(SUM(ie.points), 0) as insight_score,
  COUNT(*) as total_contributions,
  now() as last_calculated_at,
  now() as updated_at,
  now() as created_at
FROM insight_events ie
GROUP BY ie.user_id
ON CONFLICT (user_id) DO UPDATE SET
  insight_score = EXCLUDED.insight_score,
  total_contributions = EXCLUDED.total_contributions,
  last_calculated_at = EXCLUDED.last_calculated_at,
  updated_at = EXCLUDED.updated_at;

-- Update profiles.insight_score for all users
UPDATE profiles
SET insight_score = COALESCE((
  SELECT SUM(points)
  FROM insight_events
  WHERE insight_events.user_id = profiles.id
), 0);
