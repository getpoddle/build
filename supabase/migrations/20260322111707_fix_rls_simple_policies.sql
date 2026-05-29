/*
  # Fix Simple RLS Auth UID Patterns

  1. Performance Improvements
    - Replace bare auth.uid() with (select auth.uid()) for simple ownership policies
  
  2. Tables Fixed
    - assumption_challenges, assumption_comment_mentions, assumption_forecasts
    - assumption_mentions, assumption_risks, assumption_scenarios
    - challenge_mentions, challenge_response_mentions
    - notifications, pod_assumptions, pod_forecasts, pod_options, pod_risks
    - referral_codes, referral_rewards, referral_signups, user_blocks
*/

-- assumption_challenges
DROP POLICY IF EXISTS "Authenticated users can insert challenges" ON public.assumption_challenges;
CREATE POLICY "Authenticated users can insert challenges"
  ON public.assumption_challenges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can delete their challenges" ON public.assumption_challenges;
CREATE POLICY "Authors can delete their challenges"
  ON public.assumption_challenges FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- assumption_comment_mentions
DROP POLICY IF EXISTS "Users can create comment mentions" ON public.assumption_comment_mentions;
CREATE POLICY "Users can create comment mentions"
  ON public.assumption_comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own comment mentions" ON public.assumption_comment_mentions;
CREATE POLICY "Users can delete their own comment mentions"
  ON public.assumption_comment_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view comment mentions" ON public.assumption_comment_mentions;
CREATE POLICY "Users can view comment mentions"
  ON public.assumption_comment_mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = (select auth.uid()) OR mentioned_by_user_id = (select auth.uid()));

-- assumption_forecasts
DROP POLICY IF EXISTS "Users can delete own assumption forecasts" ON public.assumption_forecasts;
CREATE POLICY "Users can delete own assumption forecasts"
  ON public.assumption_forecasts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own assumption forecasts" ON public.assumption_forecasts;
CREATE POLICY "Users can insert own assumption forecasts"
  ON public.assumption_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own assumption forecasts" ON public.assumption_forecasts;
CREATE POLICY "Users can update own assumption forecasts"
  ON public.assumption_forecasts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- assumption_mentions
DROP POLICY IF EXISTS "Users can delete their own mentions" ON public.assumption_mentions;
CREATE POLICY "Users can delete their own mentions"
  ON public.assumption_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view mentions they're in" ON public.assumption_mentions;
CREATE POLICY "Users can view mentions they're in"
  ON public.assumption_mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = (select auth.uid()) OR mentioned_by_user_id = (select auth.uid()));

-- assumption_risks
DROP POLICY IF EXISTS "Users can delete own assumption risks" ON public.assumption_risks;
CREATE POLICY "Users can delete own assumption risks"
  ON public.assumption_risks FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert assumption risks" ON public.assumption_risks;
CREATE POLICY "Users can insert assumption risks"
  ON public.assumption_risks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- assumption_scenarios
DROP POLICY IF EXISTS "Users can delete own assumption scenarios" ON public.assumption_scenarios;
CREATE POLICY "Users can delete own assumption scenarios"
  ON public.assumption_scenarios FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own assumption scenarios" ON public.assumption_scenarios;
CREATE POLICY "Users can insert own assumption scenarios"
  ON public.assumption_scenarios FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

-- challenge_mentions
DROP POLICY IF EXISTS "Users can create challenge mentions" ON public.challenge_mentions;
CREATE POLICY "Users can create challenge mentions"
  ON public.challenge_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own challenge mentions" ON public.challenge_mentions;
CREATE POLICY "Users can delete their own challenge mentions"
  ON public.challenge_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = (select auth.uid()));

-- challenge_response_mentions
DROP POLICY IF EXISTS "Users can create response mentions" ON public.challenge_response_mentions;
CREATE POLICY "Users can create response mentions"
  ON public.challenge_response_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own response mentions" ON public.challenge_response_mentions;
CREATE POLICY "Users can delete their own response mentions"
  ON public.challenge_response_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = (select auth.uid()));

-- notifications
DROP POLICY IF EXISTS "Users can create notifications for others" ON public.notifications;
CREATE POLICY "Users can create notifications for others"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (actor_id = (select auth.uid()));

-- pod_assumptions
DROP POLICY IF EXISTS "Authenticated users can insert assumptions" ON public.pod_assumptions;
CREATE POLICY "Authenticated users can insert assumptions"
  ON public.pod_assumptions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can delete their assumptions" ON public.pod_assumptions;
CREATE POLICY "Authors can delete their assumptions"
  ON public.pod_assumptions FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can update their assumptions" ON public.pod_assumptions;
CREATE POLICY "Authors can update their assumptions"
  ON public.pod_assumptions FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- pod_forecasts
DROP POLICY IF EXISTS "Users can delete their own forecast" ON public.pod_forecasts;
CREATE POLICY "Users can delete their own forecast"
  ON public.pod_forecasts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own forecast" ON public.pod_forecasts;
CREATE POLICY "Users can insert their own forecast"
  ON public.pod_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own forecast" ON public.pod_forecasts;
CREATE POLICY "Users can update their own forecast"
  ON public.pod_forecasts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- pod_options
DROP POLICY IF EXISTS "Authenticated users can insert options" ON public.pod_options;
CREATE POLICY "Authenticated users can insert options"
  ON public.pod_options FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can delete their options" ON public.pod_options;
CREATE POLICY "Authors can delete their options"
  ON public.pod_options FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can update their options" ON public.pod_options;
CREATE POLICY "Authors can update their options"
  ON public.pod_options FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- pod_risks
DROP POLICY IF EXISTS "Authenticated users can insert risks" ON public.pod_risks;
CREATE POLICY "Authenticated users can insert risks"
  ON public.pod_risks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can delete their risks" ON public.pod_risks;
CREATE POLICY "Authors can delete their risks"
  ON public.pod_risks FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Authors can update their risks" ON public.pod_risks;
CREATE POLICY "Authors can update their risks"
  ON public.pod_risks FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- referral_codes
DROP POLICY IF EXISTS "Users can insert own referral code" ON public.referral_codes;
CREATE POLICY "Users can insert own referral code"
  ON public.referral_codes FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own referral code" ON public.referral_codes;
CREATE POLICY "Users can view own referral code"
  ON public.referral_codes FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- referral_signups
DROP POLICY IF EXISTS "Users can view their referral stats" ON public.referral_signups;
CREATE POLICY "Users can view their referral stats"
  ON public.referral_signups FOR SELECT
  TO authenticated
  USING (referrer_id = (select auth.uid()) OR referred_id = (select auth.uid()));

-- referral_rewards
DROP POLICY IF EXISTS "Users can view own rewards" ON public.referral_rewards;
CREATE POLICY "Users can view own rewards"
  ON public.referral_rewards FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- user_blocks
DROP POLICY IF EXISTS "Users can create own blocks" ON public.user_blocks;
CREATE POLICY "Users can create own blocks"
  ON public.user_blocks FOR INSERT
  TO authenticated
  WITH CHECK (blocker_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own blocks" ON public.user_blocks;
CREATE POLICY "Users can delete own blocks"
  ON public.user_blocks FOR DELETE
  TO authenticated
  USING (blocker_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own blocks" ON public.user_blocks;
CREATE POLICY "Users can view own blocks"
  ON public.user_blocks FOR SELECT
  TO authenticated
  USING (blocker_id = (select auth.uid()));
