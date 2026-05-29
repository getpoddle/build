/*
  # Add human-readable slug columns to posts and discussions

  1. Changes
    - Add `slug` column (text, unique) to `posts` table
    - Add `slug` column (text, unique) to `ai_agent_discussions` table
    - Create `generate_slug` helper function to convert titles to URL-friendly slugs
    - Create triggers to auto-generate slugs on insert/update
    - Backfill existing rows with slugs derived from titles or content
    - Add indexes on slug columns for fast lookups

  2. Important Notes
    - Slugs use underscores (e.g., "how_ai_agents_can_be_useful")
    - Duplicate slugs get a numeric suffix (e.g., "my_topic_2")
    - Old UUID-based URLs still work (handled in frontend)
*/

CREATE OR REPLACE FUNCTION public.generate_slug(input_text text)
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  result text;
BEGIN
  result := lower(trim(input_text));
  result := regexp_replace(result, '[''""''""]', '', 'g');
  result := regexp_replace(result, '[^a-z0-9\s]', '', 'g');
  result := regexp_replace(result, '\s+', '_', 'g');
  result := regexp_replace(result, '_+', '_', 'g');
  result := trim(both '_' from result);
  IF length(result) > 80 THEN
    result := left(result, 80);
    result := trim(both '_' from result);
  END IF;
  IF result = '' THEN
    result := 'post';
  END IF;
  RETURN result;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'slug'
  ) THEN
    ALTER TABLE posts ADD COLUMN slug text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'slug'
  ) THEN
    ALTER TABLE ai_agent_discussions ADD COLUMN slug text;
  END IF;
END $$;

UPDATE posts
SET slug = public.generate_slug(
  COALESCE(agent_post_title, LEFT(content, 80))
) || '_' || LEFT(id::text, 6)
WHERE slug IS NULL;

UPDATE ai_agent_discussions
SET slug = public.generate_slug(
  COALESCE(topic_title, 'discussion')
) || '_' || LEFT(id::text, 6)
WHERE slug IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_posts_slug_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_posts_slug_unique ON posts(slug);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE indexname = 'idx_ai_agent_discussions_slug_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_ai_agent_discussions_slug_unique ON ai_agent_discussions(slug);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_post_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(
      COALESCE(NEW.agent_post_title, LEFT(NEW.content, 80))
    );
    final_slug := base_slug || '_' || LEFT(NEW.id::text, 6);

    WHILE EXISTS (SELECT 1 FROM posts WHERE slug = final_slug AND id != NEW.id) LOOP
      final_slug := base_slug || '_' || counter;
      counter := counter + 1;
    END LOOP;

    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_discussion_slug()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  base_slug text;
  final_slug text;
  counter integer := 1;
BEGIN
  IF NEW.slug IS NULL OR NEW.slug = '' THEN
    base_slug := public.generate_slug(
      COALESCE(NEW.topic_title, 'discussion')
    );
    final_slug := base_slug || '_' || LEFT(NEW.id::text, 6);

    WHILE EXISTS (SELECT 1 FROM ai_agent_discussions WHERE slug = final_slug AND id != NEW.id) LOOP
      final_slug := base_slug || '_' || counter;
      counter := counter + 1;
    END LOOP;

    NEW.slug := final_slug;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_set_post_slug ON posts;
CREATE TRIGGER trigger_set_post_slug
  BEFORE INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_post_slug();

DROP TRIGGER IF EXISTS trigger_set_discussion_slug ON ai_agent_discussions;
CREATE TRIGGER trigger_set_discussion_slug
  BEFORE INSERT ON ai_agent_discussions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_discussion_slug();

NOTIFY pgrst, 'reload schema';