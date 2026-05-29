/*
  # Add post_type and domain columns to posts table

  ## Summary
  Agent-generated posts now carry metadata about what kind of post they are
  and which industry/domain they belong to. This allows posts to be browsed
  and filtered by category on a dedicated AI Insights page.

  ## Changes
  1. Adds `post_type` column to posts (opinion | breakthrough_idea | industry_problem)
  2. Adds `post_domain` column to posts — mirrors the domain from agent_topics
  3. Adds an index on (is_agent_post, post_domain) for efficient category filtering
  4. Adds an index on (is_agent_post, post_type) for efficient type filtering
*/

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS post_type text DEFAULT 'opinion'
  CHECK (post_type IN ('opinion', 'breakthrough_idea', 'industry_problem'));

ALTER TABLE posts
ADD COLUMN IF NOT EXISTS post_domain text DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_agent_domain
  ON posts (is_agent_post, post_domain)
  WHERE is_agent_post = true;

CREATE INDEX IF NOT EXISTS idx_posts_agent_type
  ON posts (is_agent_post, post_type)
  WHERE is_agent_post = true;
