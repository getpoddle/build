/*
  # Remove Unused Indexes

  1. Performance Improvements
    - Remove indexes that haven't been used
    - Reduces storage overhead and write performance impact
  
  2. Indexes Removed (37 total)
    - Various unused indexes across multiple tables
*/

-- Decision thread related
DROP INDEX IF EXISTS idx_decision_thread_tags_thread_id;
DROP INDEX IF EXISTS idx_decision_thread_tags_user_id;
DROP INDEX IF EXISTS idx_decision_thread_links_thread_id;
DROP INDEX IF EXISTS idx_decision_thread_links_linked_thread_id;
DROP INDEX IF EXISTS idx_decision_thread_members_thread_id;
DROP INDEX IF EXISTS idx_decision_thread_members_user_id;
DROP INDEX IF EXISTS idx_decision_threads_stage;

-- Pod related
DROP INDEX IF EXISTS idx_pod_options_pod_id;

-- Post related
DROP INDEX IF EXISTS idx_post_attachments_post_id;
DROP INDEX IF EXISTS idx_post_attachments_post_comment_id;
DROP INDEX IF EXISTS idx_post_comments_author_id;
DROP INDEX IF EXISTS idx_post_comments_post_id;
DROP INDEX IF EXISTS idx_post_likes_user_id;
DROP INDEX IF EXISTS idx_post_tags_pod_id;

-- Learning paths
DROP INDEX IF EXISTS idx_learning_path_progress_item_id;

-- Marketplace
DROP INDEX IF EXISTS idx_marketplace_items_seller_id;

-- Messages
DROP INDEX IF EXISTS idx_messages_sender_id;

-- User challenges
DROP INDEX IF EXISTS idx_user_challenges_user_id;

-- Insight events
DROP INDEX IF EXISTS idx_insight_events_created_at;
DROP INDEX IF EXISTS idx_insight_events_contribution;

-- Referral rewards
DROP INDEX IF EXISTS idx_referral_rewards_user_id;

-- User account status
DROP INDEX IF EXISTS idx_user_account_status_user_status;

-- Content reports
DROP INDEX IF EXISTS idx_content_reports_status_created;

-- Assumption mentions
DROP INDEX IF EXISTS idx_assumption_mentions_assumption;

-- Assumption comment mentions
DROP INDEX IF EXISTS idx_assumption_comment_mentions_comment;

-- Challenge response mentions
DROP INDEX IF EXISTS idx_challenge_response_mentions_response;

-- Forecast comments
DROP INDEX IF EXISTS idx_forecast_comments_forecast;
DROP INDEX IF EXISTS idx_forecast_comments_created;

-- Risk comments
DROP INDEX IF EXISTS idx_risk_comments_risk;
DROP INDEX IF EXISTS idx_risk_comments_created;

-- Scenario comments
DROP INDEX IF EXISTS idx_scenario_comments_scenario;
DROP INDEX IF EXISTS idx_scenario_comments_created;

-- Reactions
DROP INDEX IF EXISTS idx_reactions_user_id;

-- Comment mentions
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_by_user_id;
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_user_id;
