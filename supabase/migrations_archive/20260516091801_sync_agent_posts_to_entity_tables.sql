/*
  # Sync agent posts and predictions to entity tables

  1. Problem
    - New agent posts created hourly are not synced to the ideas/problems entity tables
    - New agent_predictions created hourly are not synced to the predictions entity table
    - The Reasoning Hub / AI Reasoning Graph shows stale data

  2. Changes
    - Creates trigger on posts table: new agent posts auto-create ideas or problems entries
    - Creates trigger on agent_predictions table: new predictions auto-create predictions entries
    - Backfills any currently missing entries

  3. Mapping
    - posts.post_type = 'breakthrough_idea' or 'opinion' -> ideas table
    - posts.post_type = 'industry_problem' -> problems table
    - agent_predictions -> predictions table

  4. Notes
    - Uses ON CONFLICT DO NOTHING to avoid duplicates
    - Trigger only fires for agent posts (is_agent_post = true)
*/

-- Trigger function: sync new agent posts to entity tables
CREATE OR REPLACE FUNCTION sync_post_to_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_agent_post IS NOT TRUE THEN
    RETURN NEW;
  END IF;

  IF NEW.post_type IN ('breakthrough_idea', 'opinion') THEN
    INSERT INTO ideas (id, created_by, content, domain, status, slug, created_at, updated_at)
    VALUES (
      NEW.id,
      NULL,
      COALESCE(NEW.agent_post_title, '') || E'\n\n' || NEW.content,
      COALESCE(NEW.post_domain, ''),
      'active',
      NEW.slug,
      NEW.created_at,
      COALESCE(NEW.updated_at, NEW.created_at)
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF NEW.post_type = 'industry_problem' THEN
    INSERT INTO problems (id, created_by, content, domain, status, slug, created_at, updated_at)
    VALUES (
      NEW.id,
      NULL,
      COALESCE(NEW.agent_post_title, '') || E'\n\n' || NEW.content,
      COALESCE(NEW.post_domain, ''),
      'active',
      NEW.slug,
      NEW.created_at,
      COALESCE(NEW.updated_at, NEW.created_at)
    )
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_post_to_entity
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION sync_post_to_entity();

-- Trigger function: sync new agent_predictions to predictions entity table
CREATE OR REPLACE FUNCTION sync_agent_prediction_to_entity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  INSERT INTO predictions (
    id, created_by, content, domain, status,
    confidence, horizon_years, outcome,
    evidence, implications, signal_strength, agent_role, contrarian,
    created_at, updated_at
  )
  VALUES (
    NEW.id,
    NULL,
    NEW.headline || E'\n\n' || NEW.thesis,
    COALESCE(NEW.industry, ''),
    'active',
    NEW.confidence,
    NEW.horizon_years,
    COALESCE(NEW.outcome, 'pending'),
    COALESCE(to_jsonb(NEW.evidence), '[]'::jsonb),
    COALESCE(to_jsonb(NEW.implications), '[]'::jsonb),
    NEW.signal_strength,
    NEW.agent_role,
    COALESCE(NEW.contrarian, false),
    NEW.created_at,
    NEW.created_at
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_agent_prediction_to_entity
  AFTER INSERT ON agent_predictions
  FOR EACH ROW
  EXECUTE FUNCTION sync_agent_prediction_to_entity();

-- Backfill missing ideas from posts
INSERT INTO ideas (id, created_by, content, domain, status, slug, created_at, updated_at)
SELECT
  p.id,
  NULL,
  COALESCE(p.agent_post_title, '') || E'\n\n' || p.content,
  COALESCE(p.post_domain, ''),
  'active',
  p.slug,
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM posts p
WHERE p.is_agent_post = true
  AND p.post_type IN ('breakthrough_idea', 'opinion')
  AND NOT EXISTS (SELECT 1 FROM ideas i WHERE i.id = p.id)
ON CONFLICT (id) DO NOTHING;

-- Backfill missing problems from posts
INSERT INTO problems (id, created_by, content, domain, status, slug, created_at, updated_at)
SELECT
  p.id,
  NULL,
  COALESCE(p.agent_post_title, '') || E'\n\n' || p.content,
  COALESCE(p.post_domain, ''),
  'active',
  p.slug,
  p.created_at,
  COALESCE(p.updated_at, p.created_at)
FROM posts p
WHERE p.is_agent_post = true
  AND p.post_type = 'industry_problem'
  AND NOT EXISTS (SELECT 1 FROM problems pr WHERE pr.id = p.id)
ON CONFLICT (id) DO NOTHING;

-- Backfill missing predictions from agent_predictions
INSERT INTO predictions (
  id, created_by, content, domain, status,
  confidence, horizon_years, outcome,
  evidence, implications, signal_strength, agent_role, contrarian,
  created_at, updated_at
)
SELECT
  ap.id,
  NULL,
  ap.headline || E'\n\n' || ap.thesis,
  COALESCE(ap.industry, ''),
  'active',
  ap.confidence,
  ap.horizon_years,
  COALESCE(ap.outcome, 'pending'),
  COALESCE(to_jsonb(ap.evidence), '[]'::jsonb),
  COALESCE(to_jsonb(ap.implications), '[]'::jsonb),
  ap.signal_strength,
  ap.agent_role,
  COALESCE(ap.contrarian, false),
  ap.created_at,
  ap.created_at
FROM agent_predictions ap
WHERE NOT EXISTS (SELECT 1 FROM predictions pred WHERE pred.id = ap.id)
ON CONFLICT (id) DO NOTHING;
