/*
  # Add Referral Rewards System

  1. Changes to Profiles Table
    - Add `referral_points` column to track rewards
    - Add `referral_tier` column for gamification (Bronze, Silver, Gold, Platinum)

  2. New Table: referral_rewards
    - Track individual reward transactions
    - Record what action earned the reward
    - Timestamp for tracking

  3. Updated Policies
    - Fix referral_signups insert policy to allow proper tracking
    - Add policies for referral_rewards

  4. Triggers
    - Auto-award points when referral is successful
    - Update referrer's tier based on total referrals
*/

-- Add referral tracking columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referral_points'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_points integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'referral_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN referral_tier text DEFAULT 'Bronze';
  END IF;
END $$;

-- Create referral_rewards table
CREATE TABLE IF NOT EXISTS referral_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points integer NOT NULL,
  reason text NOT NULL,
  referral_signup_id uuid REFERENCES referral_signups(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Drop old restrictive policy
DROP POLICY IF EXISTS "System can insert referral signups" ON referral_signups;

-- Add better insert policy for referral_signups
CREATE POLICY "Authenticated users can insert referral signups"
  ON referral_signups FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Policies for referral_rewards
CREATE POLICY "Users can view own rewards"
  ON referral_rewards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert rewards"
  ON referral_rewards FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user_id ON referral_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_referral_points ON profiles(referral_points DESC);

-- Function to award referral points
CREATE OR REPLACE FUNCTION award_referral_points()
RETURNS TRIGGER AS $$
DECLARE
  points_to_award integer := 10;
  current_referral_count integer;
  new_tier text;
BEGIN
  -- Award points to referrer
  UPDATE profiles
  SET referral_points = referral_points + points_to_award
  WHERE id = NEW.referrer_id;

  -- Insert reward record
  INSERT INTO referral_rewards (user_id, points, reason, referral_signup_id)
  VALUES (NEW.referrer_id, points_to_award, 'New user referral', NEW.id);

  -- Count total referrals and update tier
  SELECT COUNT(*) INTO current_referral_count
  FROM referral_signups
  WHERE referrer_id = NEW.referrer_id;

  -- Determine tier based on referral count
  IF current_referral_count >= 50 THEN
    new_tier := 'Platinum';
  ELSIF current_referral_count >= 25 THEN
    new_tier := 'Gold';
  ELSIF current_referral_count >= 10 THEN
    new_tier := 'Silver';
  ELSE
    new_tier := 'Bronze';
  END IF;

  -- Update tier
  UPDATE profiles
  SET referral_tier = new_tier
  WHERE id = NEW.referrer_id;

  -- Send notification about reward
  INSERT INTO notifications (user_id, type, content, created_at)
  VALUES (
    NEW.referrer_id,
    'referral',
    format('You earned %s points! Someone joined using your invite link.', points_to_award),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to award points on new referral signup
DROP TRIGGER IF EXISTS award_referral_points_trigger ON referral_signups;
CREATE TRIGGER award_referral_points_trigger
  AFTER INSERT ON referral_signups
  FOR EACH ROW
  EXECUTE FUNCTION award_referral_points();
