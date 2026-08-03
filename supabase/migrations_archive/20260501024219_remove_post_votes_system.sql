/*
  # Remove Post Voting System

  Reverts the Reddit-style upvote/downvote system introduced earlier.

  1. Dropped Objects
    - Table `post_votes` (cascades to drop its trigger)
    - Trigger function `trigger_post_votes_changed`
    - Helper function `recompute_post_vote_counts(uuid)`
    - Columns `posts.upvote_count`, `posts.downvote_count`, `posts.score`
    - Index `idx_posts_score_created_at`

  2. Notes
    - `post_likes` data is unaffected; likes continue to function as before.
    - No user data is lost because every vote was a mirror of an existing like.
*/

DROP TRIGGER IF EXISTS post_votes_changed ON post_votes;
DROP TABLE IF EXISTS post_votes CASCADE;
DROP FUNCTION IF EXISTS trigger_post_votes_changed();
DROP FUNCTION IF EXISTS recompute_post_vote_counts(uuid);

DROP INDEX IF EXISTS idx_posts_score_created_at;

ALTER TABLE posts DROP COLUMN IF EXISTS upvote_count;
ALTER TABLE posts DROP COLUMN IF EXISTS downvote_count;
ALTER TABLE posts DROP COLUMN IF EXISTS score;
