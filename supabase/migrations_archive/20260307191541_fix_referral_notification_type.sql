/*
  # Fix Referral Notification System

  ## Problem
  The award_referral_points trigger was failing silently because:
  1. Notifications table check constraint doesn't allow 'referral' type
  2. Trigger was missing required 'title' field

  ## Changes
  1. Add 'referral' to the allowed notification types
  2. Update the trigger to include title field in notification
  3. This will allow referral rewards to work properly

  ## Security
  - No RLS changes needed
  - Trigger runs with SECURITY DEFINER to insert notifications
*/

-- Drop the old constraint
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Add the new constraint with 'referral' type included
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
  CHECK (type IN ('message', 'reaction', 'comment', 'pod_invite', 'follow', 'referral'));

-- Recreate the trigger function with the title field
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

  -- Send notification about reward (with title field)
  INSERT INTO notifications (user_id, type, title, content, created_at)
  VALUES (
    NEW.referrer_id,
    'referral',
    'Referral Reward',
    format('You earned %s points! Someone joined using your invite link.', points_to_award),
    now()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
