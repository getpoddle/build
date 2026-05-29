/*
  # Create Achievements and Leaderboard System

  1. New Tables
    - `achievements`
      - `id` (uuid, primary key)
      - `name` (text) - Achievement name
      - `description` (text) - Achievement description
      - `icon` (text) - Icon identifier
      - `category` (text) - Category: social, content, engagement, milestone
      - `requirement_type` (text) - What triggers this: posts_count, comments_count, likes_received, etc.
      - `requirement_value` (integer) - Threshold to unlock
      - `points` (integer) - XP points awarded
      - `rarity` (text) - common, rare, epic, legendary
      - `created_at` (timestamptz)
    
    - `user_achievements`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles)
      - `achievement_id` (uuid, references achievements)
      - `unlocked_at` (timestamptz)
      - Unique constraint on (user_id, achievement_id)
    
    - `user_stats`
      - `user_id` (uuid, primary key, references profiles)
      - `posts_count` (integer, default 0)
      - `comments_count` (integer, default 0)
      - `likes_given` (integer, default 0)
      - `likes_received` (integer, default 0)
      - `pods_joined` (integer, default 0)
      - `challenges_completed` (integer, default 0)
      - `current_streak` (integer, default 0)
      - `longest_streak` (integer, default 0)
      - `last_activity_date` (date)
      - `total_points` (integer, default 0)
      - `level` (integer, default 1)
      - `updated_at` (timestamptz, default now())

  2. Security
    - Enable RLS on all tables
    - Achievements are publicly readable
    - User achievements are publicly readable
    - User stats are publicly readable
    - Only system can write to these tables (via triggers)

  3. Functions & Triggers
    - Function to initialize user stats
    - Function to update user stats on actions
    - Function to check and award achievements
    - Triggers on posts, comments, post_likes, pod_members
*/

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL,
  category text NOT NULL,
  requirement_type text NOT NULL,
  requirement_value integer NOT NULL,
  points integer NOT NULL DEFAULT 0,
  rarity text NOT NULL DEFAULT 'common',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Achievements are publicly readable"
  ON achievements FOR SELECT
  TO authenticated
  USING (true);

-- Create user_achievements table
CREATE TABLE IF NOT EXISTS user_achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_id uuid NOT NULL REFERENCES achievements(id) ON DELETE CASCADE,
  unlocked_at timestamptz DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User achievements are publicly readable"
  ON user_achievements FOR SELECT
  TO authenticated
  USING (true);

-- Create user_stats table
CREATE TABLE IF NOT EXISTS user_stats (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  posts_count integer DEFAULT 0,
  comments_count integer DEFAULT 0,
  likes_given integer DEFAULT 0,
  likes_received integer DEFAULT 0,
  pods_joined integer DEFAULT 0,
  challenges_completed integer DEFAULT 0,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  last_activity_date date,
  total_points integer DEFAULT 0,
  level integer DEFAULT 1,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User stats are publicly readable"
  ON user_stats FOR SELECT
  TO authenticated
  USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement ON user_achievements(achievement_id);
CREATE INDEX IF NOT EXISTS idx_user_stats_points ON user_stats(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_user_stats_level ON user_stats(level DESC);

-- Insert predefined achievements
INSERT INTO achievements (name, description, icon, category, requirement_type, requirement_value, points, rarity) VALUES
  ('First Post', 'Create your first post', 'MessageSquare', 'content', 'posts_count', 1, 10, 'common'),
  ('Prolific Writer', 'Create 10 posts', 'FileText', 'content', 'posts_count', 10, 50, 'rare'),
  ('Content Creator', 'Create 50 posts', 'Award', 'content', 'posts_count', 50, 200, 'epic'),
  ('Legend', 'Create 100 posts', 'Crown', 'content', 'posts_count', 100, 500, 'legendary'),
  
  ('First Comment', 'Leave your first comment', 'MessageCircle', 'engagement', 'comments_count', 1, 10, 'common'),
  ('Conversationalist', 'Leave 25 comments', 'MessageSquarePlus', 'engagement', 'comments_count', 25, 50, 'rare'),
  ('Discussion Leader', 'Leave 100 comments', 'MessagesSquare', 'engagement', 'comments_count', 100, 200, 'epic'),
  
  ('First Like', 'Give your first like', 'Heart', 'social', 'likes_given', 1, 5, 'common'),
  ('Supportive', 'Give 50 likes', 'HeartHandshake', 'social', 'likes_given', 50, 30, 'rare'),
  ('Super Supporter', 'Give 200 likes', 'Hearts', 'social', 'likes_given', 200, 100, 'epic'),
  
  ('Rising Star', 'Receive 10 likes', 'Star', 'milestone', 'likes_received', 10, 30, 'rare'),
  ('Popular', 'Receive 50 likes', 'Sparkles', 'milestone', 'likes_received', 50, 100, 'epic'),
  ('Influencer', 'Receive 200 likes', 'Flame', 'milestone', 'likes_received', 200, 300, 'legendary'),
  
  ('Joiner', 'Join your first pod', 'Users', 'social', 'pods_joined', 1, 10, 'common'),
  ('Community Member', 'Join 5 pods', 'UserPlus', 'social', 'pods_joined', 5, 40, 'rare'),
  ('Networker', 'Join 10 pods', 'Network', 'social', 'pods_joined', 10, 100, 'epic'),
  
  ('Challenger', 'Complete your first challenge', 'Trophy', 'milestone', 'challenges_completed', 1, 50, 'rare'),
  ('Champion', 'Complete 5 challenges', 'Medal', 'milestone', 'challenges_completed', 5, 150, 'epic'),
  ('Master', 'Complete 10 challenges', 'Gem', 'milestone', 'challenges_completed', 10, 400, 'legendary'),
  
  ('Committed', '7 day streak', 'Zap', 'milestone', 'current_streak', 7, 100, 'rare'),
  ('Dedicated', '30 day streak', 'Flame', 'milestone', 'current_streak', 30, 300, 'epic'),
  ('Unstoppable', '90 day streak', 'Rocket', 'milestone', 'longest_streak', 90, 1000, 'legendary')
ON CONFLICT DO NOTHING;

-- Function to initialize user stats
CREATE OR REPLACE FUNCTION initialize_user_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to initialize stats for new users
DROP TRIGGER IF EXISTS trigger_initialize_user_stats ON profiles;
CREATE TRIGGER trigger_initialize_user_stats
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION initialize_user_stats();

-- Function to check and award achievements
CREATE OR REPLACE FUNCTION check_and_award_achievements(p_user_id uuid, p_stat_type text, p_stat_value integer)
RETURNS void AS $$
DECLARE
  achievement_record RECORD;
  newly_awarded boolean;
BEGIN
  FOR achievement_record IN 
    SELECT id, points FROM achievements 
    WHERE requirement_type = p_stat_type 
    AND requirement_value <= p_stat_value
  LOOP
    newly_awarded := false;
    
    -- Try to award achievement
    INSERT INTO user_achievements (user_id, achievement_id)
    VALUES (p_user_id, achievement_record.id)
    ON CONFLICT (user_id, achievement_id) DO NOTHING
    RETURNING id INTO newly_awarded;
    
    -- Update total points only if newly awarded
    IF newly_awarded THEN
      UPDATE user_stats
      SET total_points = total_points + achievement_record.points,
          level = FLOOR((total_points + achievement_record.points) / 100) + 1
      WHERE user_id = p_user_id;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update stats on post creation
CREATE OR REPLACE FUNCTION update_stats_on_post()
RETURNS TRIGGER AS $$
BEGIN
  -- Update posts count
  INSERT INTO user_stats (user_id, posts_count, last_activity_date)
  VALUES (NEW.author_id, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE
  SET posts_count = user_stats.posts_count + 1,
      last_activity_date = CURRENT_DATE,
      updated_at = now();
  
  -- Update streak
  UPDATE user_stats
  SET current_streak = CASE
    WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
    WHEN last_activity_date = CURRENT_DATE THEN current_streak
    ELSE 1
  END,
  longest_streak = GREATEST(longest_streak, CASE
    WHEN last_activity_date = CURRENT_DATE - INTERVAL '1 day' THEN current_streak + 1
    WHEN last_activity_date = CURRENT_DATE THEN current_streak
    ELSE 1
  END)
  WHERE user_id = NEW.author_id;
  
  -- Check for achievements
  PERFORM check_and_award_achievements(
    NEW.author_id, 
    'posts_count', 
    (SELECT posts_count FROM user_stats WHERE user_id = NEW.author_id)
  );
  
  PERFORM check_and_award_achievements(
    NEW.author_id, 
    'current_streak', 
    (SELECT current_streak FROM user_stats WHERE user_id = NEW.author_id)
  );
  
  PERFORM check_and_award_achievements(
    NEW.author_id, 
    'longest_streak', 
    (SELECT longest_streak FROM user_stats WHERE user_id = NEW.author_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update stats on comment creation
CREATE OR REPLACE FUNCTION update_stats_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, comments_count, last_activity_date)
  VALUES (NEW.author_id, 1, CURRENT_DATE)
  ON CONFLICT (user_id) DO UPDATE
  SET comments_count = user_stats.comments_count + 1,
      last_activity_date = CURRENT_DATE,
      updated_at = now();
  
  PERFORM check_and_award_achievements(
    NEW.author_id, 
    'comments_count', 
    (SELECT comments_count FROM user_stats WHERE user_id = NEW.author_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update stats on like
CREATE OR REPLACE FUNCTION update_stats_on_like()
RETURNS TRIGGER AS $$
BEGIN
  -- Update likes_given for the liker
  INSERT INTO user_stats (user_id, likes_given)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET likes_given = user_stats.likes_given + 1,
      updated_at = now();
  
  PERFORM check_and_award_achievements(
    NEW.user_id, 
    'likes_given', 
    (SELECT likes_given FROM user_stats WHERE user_id = NEW.user_id)
  );
  
  -- Update likes_received for post author
  INSERT INTO user_stats (user_id, likes_received)
  VALUES (
    (SELECT author_id FROM posts WHERE id = NEW.post_id),
    1
  )
  ON CONFLICT (user_id) DO UPDATE
  SET likes_received = user_stats.likes_received + 1,
      updated_at = now();
  
  PERFORM check_and_award_achievements(
    (SELECT author_id FROM posts WHERE id = NEW.post_id), 
    'likes_received', 
    (SELECT likes_received FROM user_stats WHERE user_id = (SELECT author_id FROM posts WHERE id = NEW.post_id))
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update stats on pod join
CREATE OR REPLACE FUNCTION update_stats_on_pod_join()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, pods_joined)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET pods_joined = user_stats.pods_joined + 1,
      updated_at = now();
  
  PERFORM check_and_award_achievements(
    NEW.user_id, 
    'pods_joined', 
    (SELECT pods_joined FROM user_stats WHERE user_id = NEW.user_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update stats on challenge response
CREATE OR REPLACE FUNCTION update_stats_on_challenge_response()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_stats (user_id, challenges_completed)
  VALUES (NEW.user_id, 1)
  ON CONFLICT (user_id) DO UPDATE
  SET challenges_completed = user_stats.challenges_completed + 1,
      updated_at = now();
  
  PERFORM check_and_award_achievements(
    NEW.user_id, 
    'challenges_completed', 
    (SELECT challenges_completed FROM user_stats WHERE user_id = NEW.user_id)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers
DROP TRIGGER IF EXISTS trigger_update_stats_on_post ON posts;
CREATE TRIGGER trigger_update_stats_on_post
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_post();

DROP TRIGGER IF EXISTS trigger_update_stats_on_comment ON comments;
CREATE TRIGGER trigger_update_stats_on_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_comment();

DROP TRIGGER IF EXISTS trigger_update_stats_on_like ON post_likes;
CREATE TRIGGER trigger_update_stats_on_like
  AFTER INSERT ON post_likes
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_like();

DROP TRIGGER IF EXISTS trigger_update_stats_on_pod_join ON pod_members;
CREATE TRIGGER trigger_update_stats_on_pod_join
  AFTER INSERT ON pod_members
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_pod_join();

DROP TRIGGER IF EXISTS trigger_update_stats_on_challenge_response ON challenge_responses;
CREATE TRIGGER trigger_update_stats_on_challenge_response
  AFTER INSERT ON challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION update_stats_on_challenge_response();

-- Initialize stats for existing users
INSERT INTO user_stats (user_id)
SELECT id FROM profiles
ON CONFLICT (user_id) DO NOTHING;
