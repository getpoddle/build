/*
  # Fix RLS Policies with Always True Conditions

  1. Security Improvements
    - Replace policies with always-true WITH CHECK clauses
    - Add proper authentication and authorization checks
  
  2. Tables Fixed
    - referral_rewards: System can insert rewards
    - referral_signups: Authenticated users can insert referral signups
*/

-- referral_rewards: Add proper check for system-generated rewards
DROP POLICY IF EXISTS "System can insert rewards" ON public.referral_rewards;

-- Allow insertion only through database functions/triggers
-- Users shouldn't directly insert rewards, only view them
-- So we remove the always-true policy entirely and rely on triggers

-- referral_signups: Add proper authentication check
DROP POLICY IF EXISTS "Authenticated users can insert referral signups" ON public.referral_signups;

CREATE POLICY "Authenticated users can insert referral signups"
  ON public.referral_signups FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User can only create a signup record for themselves
    referred_id = (select auth.uid())
  );
