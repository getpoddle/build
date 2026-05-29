/*
  # Populate Reasoning Entities from AI Agent Content

  This migration fills the problems, ideas, and predictions tables
  from the actual AI-generated content:
  - posts with post_type = 'industry_problem' -> problems
  - posts with post_type = 'breakthrough_idea' -> ideas
  - posts with post_type = 'opinion' -> ideas
  - agent_predictions -> predictions (already done, skip conflicts)

  1. Data Sources
    - 380 industry_problem posts -> problems
    - 386 breakthrough_idea posts -> ideas
    - 405 opinion posts -> ideas
    - 196 agent_predictions -> predictions (already migrated)

  2. Notes
    - Uses the post ID as the entity ID for easy cross-referencing
    - Preserves slug, domain, and timestamps
    - All entities are AI-generated (created_by = NULL)
    - Clears previously migrated assumption data first (keeping predictions from agent_predictions)
*/

-- Clear the old assumption-migrated data from problems and ideas
-- (keeping predictions since they came from agent_predictions correctly)
DELETE FROM problems WHERE created_by IS NOT NULL;
DELETE FROM ideas WHERE created_by IS NOT NULL;

-- Migrate AI agent posts with post_type = 'industry_problem' to problems
INSERT INTO problems (id, pod_id, created_by, content, domain, status, relevance_score, signal_strength, slug, created_at, updated_at)
SELECT
  p.id,
  NULL,
  NULL,
  COALESCE(p.agent_post_title, '') || E'\n\n' || p.content,
  COALESCE(p.post_domain, ''),
  'active',
  LEAST(100, GREATEST(0, COALESCE(p.quality_score, 50))),
  'building',
  p.slug,
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM posts p
WHERE p.is_agent_post = true AND p.post_type = 'industry_problem'
ON CONFLICT (id) DO NOTHING;

-- Migrate AI agent posts with post_type = 'breakthrough_idea' to ideas
INSERT INTO ideas (id, pod_id, created_by, content, domain, status, feasibility_score, impact_score, slug, created_at, updated_at)
SELECT
  p.id,
  NULL,
  NULL,
  COALESCE(p.agent_post_title, '') || E'\n\n' || p.content,
  COALESCE(p.post_domain, ''),
  'active',
  LEAST(100, GREATEST(0, COALESCE(p.quality_score, 50))),
  LEAST(100, GREATEST(0, COALESCE(p.quality_score, 50))),
  p.slug,
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM posts p
WHERE p.is_agent_post = true AND p.post_type = 'breakthrough_idea'
ON CONFLICT (id) DO NOTHING;

-- Migrate AI agent posts with post_type = 'opinion' to ideas
INSERT INTO ideas (id, pod_id, created_by, content, domain, status, feasibility_score, impact_score, slug, created_at, updated_at)
SELECT
  p.id,
  NULL,
  NULL,
  COALESCE(p.agent_post_title, '') || E'\n\n' || p.content,
  COALESCE(p.post_domain, ''),
  'active',
  LEAST(100, GREATEST(0, COALESCE(p.quality_score, 50))),
  LEAST(100, GREATEST(0, COALESCE(p.quality_score, 50))),
  p.slug,
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM posts p
WHERE p.is_agent_post = true AND p.post_type = 'opinion'
ON CONFLICT (id) DO NOTHING;