/*
  # Fix sync_post_to_entity trigger to include execution_steps

  1. Problem
     - The trigger that syncs agent posts to the ideas table was not populating
       execution_steps from posts.next_steps.
     - As a result, all ideas created after May 15 have execution_steps = '[]'
       (the column default), so they were hidden by a filter in the UI.

  2. Changes
     - Updates sync_post_to_entity() to include execution_steps from posts.next_steps
       when inserting into the ideas table, and updates on conflict as well.
     - Backfills all existing ideas rows that still have empty execution_steps
       by pulling next_steps from their corresponding posts entry.
*/

-- Update the trigger to include execution_steps from posts.next_steps
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
    INSERT INTO ideas (id, created_by, content, domain, status, slug, execution_steps, created_at, updated_at)
    VALUES (
      NEW.id,
      NULL,
      COALESCE(NEW.agent_post_title, '') || E'\n\n' || NEW.content,
      COALESCE(NEW.post_domain, ''),
      'active',
      NEW.slug,
      CASE
        WHEN NEW.next_steps IS NOT NULL AND NEW.next_steps <> '' AND NEW.next_steps <> '[]'
        THEN NEW.next_steps::jsonb
        ELSE '[]'::jsonb
      END,
      NEW.created_at,
      COALESCE(NEW.updated_at, NEW.created_at)
    )
    ON CONFLICT (id) DO UPDATE SET
      execution_steps = CASE
        WHEN EXCLUDED.execution_steps <> '[]'::jsonb THEN EXCLUDED.execution_steps
        ELSE ideas.execution_steps
      END,
      slug = COALESCE(EXCLUDED.slug, ideas.slug),
      updated_at = EXCLUDED.updated_at;

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

-- Backfill execution_steps for all ideas that still have the empty default
UPDATE ideas
SET execution_steps = p.next_steps::jsonb
FROM posts p
WHERE ideas.id = p.id
  AND p.is_agent_post = true
  AND p.next_steps IS NOT NULL
  AND p.next_steps <> ''
  AND p.next_steps <> '[]'
  AND (ideas.execution_steps IS NULL OR ideas.execution_steps = '[]'::jsonb);
