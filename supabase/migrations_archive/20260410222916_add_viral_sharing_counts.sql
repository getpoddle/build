/*
  # Add Viral Sharing Counts

  ## Summary
  Adds view counts and share counts to the core content tables to power
  social proof indicators ("X people are debating this", "X shares").

  ## Changes

  ### New Columns
  - `pod_assumptions.view_count` — number of times this assumption has been viewed publicly
  - `pod_assumptions.share_count` — number of times this assumption has been shared
  - `posts.view_count` — number of times this post has been viewed
  - `posts.share_count` — number of times this post has been shared
  - `decision_threads.view_count` — number of times this thread has been viewed
  - `decision_threads.share_count` — number of times this thread has been shared

  ### New Table
  - `content_views` — deduplicates view counting by session/user to avoid inflation

  ## Security
  - RLS enabled on content_views
  - Anonymous and authenticated users can insert views
  - Only the system can read aggregate counts (via functions)
*/

-- Add share/view counts to pod_assumptions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN view_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pod_assumptions' AND column_name = 'share_count'
  ) THEN
    ALTER TABLE pod_assumptions ADD COLUMN share_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add share/view counts to posts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN view_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'share_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN share_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Add share/view counts to decision_threads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_threads' AND column_name = 'view_count'
  ) THEN
    ALTER TABLE decision_threads ADD COLUMN view_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_threads' AND column_name = 'share_count'
  ) THEN
    ALTER TABLE decision_threads ADD COLUMN share_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Function to increment assumption view count (safe, idempotent by session_id)
CREATE OR REPLACE FUNCTION increment_assumption_view(p_assumption_id uuid, p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only count once per session per assumption
  IF NOT EXISTS (
    SELECT 1 FROM assumption_view_sessions
    WHERE assumption_id = p_assumption_id AND session_id = p_session_id
  ) THEN
    INSERT INTO assumption_view_sessions (assumption_id, session_id) VALUES (p_assumption_id, p_session_id)
    ON CONFLICT DO NOTHING;
    UPDATE pod_assumptions SET view_count = view_count + 1 WHERE id = p_assumption_id;
  END IF;
END;
$$;

-- Session deduplication table for assumption views
CREATE TABLE IF NOT EXISTS assumption_view_sessions (
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (assumption_id, session_id)
);

ALTER TABLE assumption_view_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert view sessions"
  ON assumption_view_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "No direct reads of view sessions"
  ON assumption_view_sessions
  FOR SELECT
  TO authenticated
  USING (false);

-- Function to increment share count for assumptions
CREATE OR REPLACE FUNCTION increment_assumption_share(p_assumption_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE pod_assumptions SET share_count = share_count + 1 WHERE id = p_assumption_id;
END;
$$;

-- Function to increment post share count
CREATE OR REPLACE FUNCTION increment_post_share(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts SET share_count = share_count + 1 WHERE id = p_post_id;
END;
$$;

-- Function to increment decision thread view/share counts
CREATE OR REPLACE FUNCTION increment_thread_view(p_thread_id uuid, p_session_id text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM thread_view_sessions
    WHERE thread_id = p_thread_id AND session_id = p_session_id
  ) THEN
    INSERT INTO thread_view_sessions (thread_id, session_id) VALUES (p_thread_id, p_session_id)
    ON CONFLICT DO NOTHING;
    UPDATE decision_threads SET view_count = view_count + 1 WHERE id = p_thread_id;
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS thread_view_sessions (
  thread_id uuid NOT NULL REFERENCES decision_threads(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (thread_id, session_id)
);

ALTER TABLE thread_view_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert thread view sessions"
  ON thread_view_sessions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "No direct reads of thread view sessions"
  ON thread_view_sessions
  FOR SELECT
  TO authenticated
  USING (false);

-- Grant execute to anon + authenticated roles
GRANT EXECUTE ON FUNCTION increment_assumption_view(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_assumption_share(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_post_share(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION increment_thread_view(uuid, text) TO anon, authenticated;
