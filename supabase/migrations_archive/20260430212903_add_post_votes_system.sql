/*
  # Reddit-Style Post Voting System

  Adds upvote/downvote functionality to posts while preserving existing post_likes data.

  1. New Tables
    - `post_votes`: stores each user's vote on a post
      - `post_id` (uuid, FK posts.id)
      - `user_id` (uuid, FK auth.users.id)
      - `direction` (smallint, 1 = upvote, -1 = downvote)
      - `created_at`, `updated_at` (timestamptz)
      - PRIMARY KEY (post_id, user_id) to enforce one vote per user per post

  2. Columns Added
    - `posts.upvote_count` (int, default 0)
    - `posts.downvote_count` (int, default 0)
    - `posts.score` (int, default 0) -- upvotes minus downvotes, used for sorting

  3. Triggers
    - trigger on post_votes INSERT/UPDATE/DELETE recomputes the affected post's counts

  4. Backfill
    - All existing rows in post_likes are copied into post_votes as upvotes

  5. Security
    - RLS enabled
    - Authenticated users can SELECT all votes
    - Authenticated users can INSERT their own vote
    - Authenticated users can UPDATE their own vote (to switch direction)
    - Authenticated users can DELETE their own vote
*/

CREATE TABLE IF NOT EXISTS post_votes (
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  direction smallint NOT NULL CHECK (direction IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_post_votes_user_id ON post_votes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_votes_post_direction ON post_votes(post_id, direction);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'upvote_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN upvote_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'downvote_count'
  ) THEN
    ALTER TABLE posts ADD COLUMN downvote_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'posts' AND column_name = 'score'
  ) THEN
    ALTER TABLE posts ADD COLUMN score integer NOT NULL DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_posts_score_created_at ON posts(score DESC, created_at DESC);

CREATE OR REPLACE FUNCTION recompute_post_vote_counts(p_post_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE posts
  SET
    upvote_count   = COALESCE((SELECT count(*) FROM post_votes WHERE post_id = p_post_id AND direction = 1), 0),
    downvote_count = COALESCE((SELECT count(*) FROM post_votes WHERE post_id = p_post_id AND direction = -1), 0),
    score          = COALESCE((SELECT count(*) FROM post_votes WHERE post_id = p_post_id AND direction = 1), 0)
                   - COALESCE((SELECT count(*) FROM post_votes WHERE post_id = p_post_id AND direction = -1), 0)
  WHERE id = p_post_id;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_post_votes_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (TG_OP = 'DELETE') THEN
    PERFORM recompute_post_vote_counts(OLD.post_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_post_vote_counts(NEW.post_id);
    IF (TG_OP = 'UPDATE' AND OLD.post_id <> NEW.post_id) THEN
      PERFORM recompute_post_vote_counts(OLD.post_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS post_votes_changed ON post_votes;
CREATE TRIGGER post_votes_changed
AFTER INSERT OR UPDATE OR DELETE ON post_votes
FOR EACH ROW EXECUTE FUNCTION trigger_post_votes_changed();

INSERT INTO post_votes (post_id, user_id, direction, created_at)
SELECT pl.post_id, pl.user_id, 1, pl.created_at
FROM post_likes pl
WHERE NOT EXISTS (
  SELECT 1 FROM post_votes pv
  WHERE pv.post_id = pl.post_id AND pv.user_id = pl.user_id
)
ON CONFLICT (post_id, user_id) DO NOTHING;

UPDATE posts p
SET
  upvote_count   = COALESCE(u.c, 0),
  downvote_count = COALESCE(d.c, 0),
  score          = COALESCE(u.c, 0) - COALESCE(d.c, 0)
FROM
  (SELECT post_id, count(*) AS c FROM post_votes WHERE direction =  1 GROUP BY post_id) u
  FULL OUTER JOIN
  (SELECT post_id, count(*) AS c FROM post_votes WHERE direction = -1 GROUP BY post_id) d
  ON u.post_id = d.post_id
WHERE p.id = COALESCE(u.post_id, d.post_id);

ALTER TABLE post_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view post votes" ON post_votes;
CREATE POLICY "Anyone can view post votes"
  ON post_votes FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Users can insert own vote" ON post_votes;
CREATE POLICY "Users can insert own vote"
  ON post_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vote" ON post_votes;
CREATE POLICY "Users can update own vote"
  ON post_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vote" ON post_votes;
CREATE POLICY "Users can delete own vote"
  ON post_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
