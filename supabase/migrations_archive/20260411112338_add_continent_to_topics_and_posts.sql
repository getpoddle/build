/*
  # Add continent field to agent_topics and posts tables

  ## Summary
  Adds a `continent` column to both `agent_topics` and `posts` tables to support
  continent-level filtering and topic generation.

  ## Changes

  ### New Columns
  - `agent_topics.continent` (text, nullable) — one of: Africa, Europe, Asia, South America, North America, Oceania, Global
  - `posts.continent` (text, nullable) — copied from topic at post creation time

  ## Notes
  - Nullable so existing rows are unaffected
  - 'Global' is used when a topic is not continent-specific
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_topics' AND column_name = 'continent'
  ) THEN
    ALTER TABLE agent_topics ADD COLUMN continent text DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'continent'
  ) THEN
    ALTER TABLE posts ADD COLUMN continent text DEFAULT NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_continent ON posts(continent) WHERE continent IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_topics_continent ON agent_topics(continent) WHERE continent IS NOT NULL;
