/*
  # Remove Unused Indexes

  1. Changes
    - Drop indexes that are not being used by queries
    - Reduces storage overhead and improves write performance
    - Removes maintenance burden for unused indexes

  2. Indexes Removed
    - idx_assumption_challenges_user_id
    - idx_assumption_forecasts_user_id
    - idx_assumption_risks_created_by
    - idx_challenge_responses_user_id
    - idx_decision_thread_links_created_by
    - idx_decision_thread_updates_user_id
    - idx_pod_options_created_by
    - idx_pod_risks_created_by
    - idx_pod_risks_option_id
    - idx_referral_rewards_referral_signup_id
    - idx_email_queue_sent

  3. Note
    - These indexes were identified by database usage analysis
    - If usage patterns change, indexes can be recreated
*/

-- Drop unused indexes
DROP INDEX IF EXISTS idx_assumption_challenges_user_id;
DROP INDEX IF EXISTS idx_assumption_forecasts_user_id;
DROP INDEX IF EXISTS idx_assumption_risks_created_by;
DROP INDEX IF EXISTS idx_challenge_responses_user_id;
DROP INDEX IF EXISTS idx_decision_thread_links_created_by;
DROP INDEX IF EXISTS idx_decision_thread_updates_user_id;
DROP INDEX IF EXISTS idx_pod_options_created_by;
DROP INDEX IF EXISTS idx_pod_risks_created_by;
DROP INDEX IF EXISTS idx_pod_risks_option_id;
DROP INDEX IF EXISTS idx_referral_rewards_referral_signup_id;
DROP INDEX IF EXISTS idx_email_queue_sent;
