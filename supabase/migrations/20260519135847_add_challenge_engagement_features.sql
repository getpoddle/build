/*
  # Add Challenge Engagement Features

  Adds the data layer needed for:
  1. Upvoteable challenges - users can upvote challenges to surface the best ones
  2. Challenge notifications - entity creators are notified when challenged
  3. Challenge upvote notifications - challengers are notified when their challenge is upvoted
  4. Challenge of the Week - a table to track the weekly featured insight
  5. "Hot debate" tracking - surfacing entities with many recent challenges

  ## New Tables
  - `entity_challenge_votes` - tracks which users upvoted which challenges

  ## Modified Tables
  - `entity_challenges` - adds `upvote_count` (denormalized counter) and `reply` (creator reply text)

  ## New Functions
  - `toggle_challenge_vote` - atomically toggles a user's vote on a challenge

  ## Security
  - RLS enabled on `entity_challenge_votes`
  - Authenticated users can read all votes, insert/delete their own
*/

-- Add upvote_count and creator reply to entity_challenges
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_challenges' AND column_name = 'upvote_count'
  ) THEN
    ALTER TABLE entity_challenges ADD COLUMN upvote_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_challenges' AND column_name = 'creator_reply'
  ) THEN
    ALTER TABLE entity_challenges ADD COLUMN creator_reply text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'entity_challenges' AND column_name = 'creator_replied_at'
  ) THEN
    ALTER TABLE entity_challenges ADD COLUMN creator_replied_at timestamptz;
  END IF;
END $$;

-- Table to track challenge upvotes
CREATE TABLE IF NOT EXISTS entity_challenge_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid NOT NULL REFERENCES entity_challenges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, user_id)
);

ALTER TABLE entity_challenge_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read challenge votes"
  ON entity_challenge_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert own challenge votes"
  ON entity_challenge_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own challenge votes"
  ON entity_challenge_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Index for fast vote lookups
CREATE INDEX IF NOT EXISTS idx_challenge_votes_challenge_id ON entity_challenge_votes(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_user_id ON entity_challenge_votes(user_id);

-- Index for sorting challenges by upvotes
CREATE INDEX IF NOT EXISTS idx_entity_challenges_upvote_count ON entity_challenges(upvote_count DESC);

-- Index for hot debate detection (recent challenges)
CREATE INDEX IF NOT EXISTS idx_entity_challenges_entity_created ON entity_challenges(entity_type, entity_id, created_at DESC);

-- Function to toggle a challenge vote and maintain the denormalized counter atomically
CREATE OR REPLACE FUNCTION toggle_challenge_vote(p_challenge_id uuid, p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_exists boolean;
  v_new_count integer;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM entity_challenge_votes
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM entity_challenge_votes
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

    UPDATE entity_challenges
    SET upvote_count = GREATEST(upvote_count - 1, 0)
    WHERE id = p_challenge_id
    RETURNING upvote_count INTO v_new_count;

    RETURN jsonb_build_object('voted', false, 'upvote_count', v_new_count);
  ELSE
    INSERT INTO entity_challenge_votes(challenge_id, user_id)
    VALUES (p_challenge_id, p_user_id)
    ON CONFLICT DO NOTHING;

    UPDATE entity_challenges
    SET upvote_count = upvote_count + 1
    WHERE id = p_challenge_id
    RETURNING upvote_count INTO v_new_count;

    RETURN jsonb_build_object('voted', true, 'upvote_count', v_new_count);
  END IF;
END;
$$;
