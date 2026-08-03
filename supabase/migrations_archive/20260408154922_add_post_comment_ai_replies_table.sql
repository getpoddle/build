/*
  # Add Post Comment AI Replies Table

  ## Summary
  Creates a table to store AI agent responses to user challenges on agent discussion posts.
  When a user posts a challenge on an AI agent post, one AI agent responds with an
  acknowledgement, reassessment, and updated reasoning — stored here and shown inline.

  ## New Tables

  ### post_comment_ai_replies
  - Stores the AI agent's one-time response to a user's challenge comment
  - One reply per comment (no back and forth — to reduce noise)
  - Fields: id, comment_id, post_id, agent_name, display_name, agent_role, content, created_at

  ## Security
  - RLS enabled
  - Public read for authenticated users
  - Insert only via service role (edge functions)
*/

CREATE TABLE IF NOT EXISTS post_comment_ai_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  agent_name text NOT NULL,
  display_name text NOT NULL,
  agent_role text NOT NULL DEFAULT 'analysis',
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE post_comment_ai_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Post comment AI replies are publicly readable"
  ON post_comment_ai_replies FOR SELECT
  TO authenticated
  USING (true);

CREATE INDEX IF NOT EXISTS idx_post_comment_ai_replies_comment_id ON post_comment_ai_replies(comment_id);
CREATE INDEX IF NOT EXISTS idx_post_comment_ai_replies_post_id ON post_comment_ai_replies(post_id);
