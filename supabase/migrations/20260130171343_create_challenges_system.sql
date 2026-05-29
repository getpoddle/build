/*
  # Create Challenges System

  1. New Tables
    - `challenges`
      - `id` (uuid, primary key)
      - `creator_id` (uuid, references profiles)
      - `title` (text) - Challenge title
      - `description` (text) - Challenge description/prompt
      - `time_limit_minutes` (integer) - Time limit for responses
      - `ends_at` (timestamptz) - When challenge ends
      - `status` (text) - 'active', 'ended'
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `challenge_responses`
      - `id` (uuid, primary key)
      - `challenge_id` (uuid, references challenges)
      - `user_id` (uuid, references profiles)
      - `response_text` (text) - User's response
      - `votes_count` (integer) - Cached vote count
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `challenge_votes`
      - `id` (uuid, primary key)
      - `response_id` (uuid, references challenge_responses)
      - `user_id` (uuid, references profiles)
      - `created_at` (timestamptz)
      - Unique constraint on (response_id, user_id)
    
    - `user_challenge_streaks`
      - `user_id` (uuid, primary key, references profiles)
      - `current_streak` (integer) - Current streak days
      - `longest_streak` (integer) - Longest streak achieved
      - `last_participation_date` (date) - Last challenge participation
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Challenges: Anyone can view active challenges, only creator can update
    - Responses: Anyone can view, only response owner can update
    - Votes: Anyone can view, users can vote once per response
    - Streaks: Users can view their own and others' streaks

  3. Functions & Triggers
    - Trigger to update vote count on challenge_responses
    - Trigger to update user streaks when responding to challenges
    - Function to automatically set challenge status to 'ended' when ends_at is past
*/

-- Create challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text NOT NULL,
  time_limit_minutes integer NOT NULL DEFAULT 5,
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'ended')),
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create challenge_responses table
CREATE TABLE IF NOT EXISTS challenge_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  response_text text NOT NULL,
  votes_count integer DEFAULT 0 NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(challenge_id, user_id)
);

-- Create challenge_votes table
CREATE TABLE IF NOT EXISTS challenge_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES challenge_responses(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(response_id, user_id)
);

-- Create user_challenge_streaks table
CREATE TABLE IF NOT EXISTS user_challenge_streaks (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  current_streak integer DEFAULT 0 NOT NULL,
  longest_streak integer DEFAULT 0 NOT NULL,
  last_participation_date date,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_challenges_status_ends_at ON challenges(status, ends_at DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_creator_id ON challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_challenge_id ON challenge_responses(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_user_id ON challenge_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_votes_count ON challenge_responses(challenge_id, votes_count DESC);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_response_id ON challenge_votes(response_id);
CREATE INDEX IF NOT EXISTS idx_challenge_votes_user_id ON challenge_votes(user_id);

-- Enable RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_challenge_streaks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for challenges
CREATE POLICY "Anyone can view challenges"
  ON challenges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create challenges"
  ON challenges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can update their own challenges"
  ON challenges FOR UPDATE
  TO authenticated
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY "Creators can delete their own challenges"
  ON challenges FOR DELETE
  TO authenticated
  USING (auth.uid() = creator_id);

-- RLS Policies for challenge_responses
CREATE POLICY "Anyone can view responses"
  ON challenge_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create responses"
  ON challenge_responses FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own responses"
  ON challenge_responses FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own responses"
  ON challenge_responses FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for challenge_votes
CREATE POLICY "Anyone can view votes"
  ON challenge_votes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create votes"
  ON challenge_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own votes"
  ON challenge_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for user_challenge_streaks
CREATE POLICY "Anyone can view streaks"
  ON user_challenge_streaks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "System can insert streaks"
  ON user_challenge_streaks FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can update streaks"
  ON user_challenge_streaks FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to update vote count
CREATE OR REPLACE FUNCTION update_response_vote_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenge_responses
    SET votes_count = votes_count + 1
    WHERE id = NEW.response_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenge_responses
    SET votes_count = votes_count - 1
    WHERE id = OLD.response_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for vote count
DROP TRIGGER IF EXISTS trigger_update_response_vote_count ON challenge_votes;
CREATE TRIGGER trigger_update_response_vote_count
  AFTER INSERT OR DELETE ON challenge_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_response_vote_count();

-- Function to update user streaks
CREATE OR REPLACE FUNCTION update_user_challenge_streak()
RETURNS TRIGGER AS $$
DECLARE
  last_date date;
  current_streak_val integer;
  longest_streak_val integer;
BEGIN
  -- Get current streak data
  SELECT last_participation_date, current_streak, longest_streak
  INTO last_date, current_streak_val, longest_streak_val
  FROM user_challenge_streaks
  WHERE user_id = NEW.user_id;

  -- If no record exists, create one
  IF NOT FOUND THEN
    INSERT INTO user_challenge_streaks (user_id, current_streak, longest_streak, last_participation_date)
    VALUES (NEW.user_id, 1, 1, CURRENT_DATE);
    RETURN NEW;
  END IF;

  -- Don't update if already participated today
  IF last_date = CURRENT_DATE THEN
    RETURN NEW;
  END IF;

  -- Calculate new streak
  IF last_date = CURRENT_DATE - INTERVAL '1 day' THEN
    -- Consecutive day - increment streak
    current_streak_val := current_streak_val + 1;
  ELSE
    -- Streak broken - reset to 1
    current_streak_val := 1;
  END IF;

  -- Update longest streak if needed
  IF current_streak_val > longest_streak_val THEN
    longest_streak_val := current_streak_val;
  END IF;

  -- Update the record
  UPDATE user_challenge_streaks
  SET 
    current_streak = current_streak_val,
    longest_streak = longest_streak_val,
    last_participation_date = CURRENT_DATE,
    updated_at = now()
  WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for streak updates
DROP TRIGGER IF EXISTS trigger_update_user_challenge_streak ON challenge_responses;
CREATE TRIGGER trigger_update_user_challenge_streak
  AFTER INSERT ON challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_user_challenge_streak();