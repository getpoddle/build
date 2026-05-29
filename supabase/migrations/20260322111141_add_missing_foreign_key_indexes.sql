/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all unindexed foreign keys to improve query performance
    - Covers 19 foreign key columns across multiple tables
  
  2. Tables Affected
    - assumption_challenges: user_id
    - assumption_comment_mentions: mentioned_by_user_id
    - assumption_forecasts: user_id
    - assumption_mentions: mentioned_by_user_id
    - assumption_risks: created_by
    - challenge_mentions: mentioned_by_user_id
    - challenge_response_mentions: mentioned_by_user_id
    - challenge_responses: user_id
    - challenges: creator_id
    - content_reports: reviewed_by
    - decision_thread_links: created_by
    - decision_thread_updates: user_id
    - jobs: poster_id
    - pod_assumptions: created_by
    - pod_options: created_by
    - pod_risks: created_by, option_id
    - referral_rewards: referral_signup_id
    - user_account_status: suspended_by
*/

-- Add indexes for foreign keys
CREATE INDEX IF NOT EXISTS idx_assumption_challenges_user_id ON public.assumption_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_comment_mentions_mentioned_by_user_id ON public.assumption_comment_mentions(mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_forecasts_user_id ON public.assumption_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_mentions_mentioned_by_user_id ON public.assumption_mentions(mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_risks_created_by ON public.assumption_risks(created_by);
CREATE INDEX IF NOT EXISTS idx_challenge_mentions_mentioned_by_user_id ON public.challenge_mentions(mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_response_mentions_mentioned_by_user_id ON public.challenge_response_mentions(mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_responses_user_id ON public.challenge_responses(user_id);
CREATE INDEX IF NOT EXISTS idx_challenges_creator_id ON public.challenges(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_reports_reviewed_by ON public.content_reports(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_decision_thread_links_created_by ON public.decision_thread_links(created_by);
CREATE INDEX IF NOT EXISTS idx_decision_thread_updates_user_id ON public.decision_thread_updates(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_poster_id ON public.jobs(poster_id);
CREATE INDEX IF NOT EXISTS idx_pod_assumptions_created_by ON public.pod_assumptions(created_by);
CREATE INDEX IF NOT EXISTS idx_pod_options_created_by ON public.pod_options(created_by);
CREATE INDEX IF NOT EXISTS idx_pod_risks_created_by ON public.pod_risks(created_by);
CREATE INDEX IF NOT EXISTS idx_pod_risks_option_id ON public.pod_risks(option_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral_signup_id ON public.referral_rewards(referral_signup_id);
CREATE INDEX IF NOT EXISTS idx_user_account_status_suspended_by ON public.user_account_status(suspended_by);
