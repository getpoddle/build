/*
  # Create Invite/Referral System

  1. New Tables
    - `referral_codes`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - owner of the code
      - `code` (text, unique) - the actual referral code (e.g., JOHN123)
      - `created_at` (timestamptz)
    
    - `referral_signups`
      - `id` (uuid, primary key)
      - `referrer_id` (uuid, references profiles) - user who sent invite
      - `referred_id` (uuid, references profiles) - user who signed up via invite
      - `referral_code` (text) - code that was used
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on all tables
    - Users can view their own referral code
    - Users can view their own referral stats
    - Users can insert their own referral code
    - Track referral signups securely

  3. Indexes
    - Index on referral_codes.code for lookups
    - Index on referral_codes.user_id for user queries
    - Index on referral_signups.referrer_id for stats
*/

-- Create referral_codes table
CREATE TABLE IF NOT EXISTS referral_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create referral_signups table
CREATE TABLE IF NOT EXISTS referral_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referral_code text NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(referred_id)
);

-- Enable RLS
ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_signups ENABLE ROW LEVEL SECURITY;

-- Policies for referral_codes
CREATE POLICY "Users can view own referral code"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own referral code"
  ON referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view referral codes by code"
  ON referral_codes FOR SELECT
  TO authenticated
  USING (true);

-- Policies for referral_signups
CREATE POLICY "Users can view their referral stats"
  ON referral_signups FOR SELECT
  TO authenticated
  USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "System can insert referral signups"
  ON referral_signups FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = referred_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON referral_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referrer_id ON referral_signups(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_signups_referred_id ON referral_signups(referred_id);
