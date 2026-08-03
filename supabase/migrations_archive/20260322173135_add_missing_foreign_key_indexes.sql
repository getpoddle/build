/*
  # Add Missing Foreign Key Indexes

  1. Performance Improvements
    - Add indexes for all foreign keys that are missing covering indexes
    - This improves JOIN performance and foreign key constraint checking
    - Covers 21 unindexed foreign keys identified by security audit

  2. Tables Affected
    - comment_mentions
    - decision_thread_links
    - decision_thread_members
    - decision_thread_tags
    - forecast_comments
    - learning_path_progress
    - marketplace_items
    - messages
    - pod_options
    - post_attachments
    - post_comments
    - post_likes
    - post_tags
    - reactions
    - referral_rewards
    - risk_comments
    - scenario_comments
    - user_challenges
*/

-- comment_mentions indexes
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_by_user 
  ON comment_mentions(mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_user 
  ON comment_mentions(mentioned_user_id);

-- decision_thread_links indexes
CREATE INDEX IF NOT EXISTS idx_decision_thread_links_linked_thread 
  ON decision_thread_links(linked_thread_id);

-- decision_thread_members indexes
CREATE INDEX IF NOT EXISTS idx_decision_thread_members_user 
  ON decision_thread_members(user_id);

-- decision_thread_tags indexes
CREATE INDEX IF NOT EXISTS idx_decision_thread_tags_user 
  ON decision_thread_tags(user_id);

-- forecast_comments indexes (already has idx_forecast_comments_forecast, checking for completeness)
CREATE INDEX IF NOT EXISTS idx_forecast_comments_forecast_id 
  ON forecast_comments(forecast_id);

-- learning_path_progress indexes
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_item 
  ON learning_path_progress(learning_path_item_id);

-- marketplace_items indexes
CREATE INDEX IF NOT EXISTS idx_marketplace_items_seller 
  ON marketplace_items(seller_id);

-- messages indexes
CREATE INDEX IF NOT EXISTS idx_messages_sender 
  ON messages(sender_id);

-- pod_options indexes
CREATE INDEX IF NOT EXISTS idx_pod_options_pod 
  ON pod_options(pod_id);

-- post_attachments indexes
CREATE INDEX IF NOT EXISTS idx_post_attachments_comment 
  ON post_attachments(post_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_attachments_post 
  ON post_attachments(post_id);

-- post_comments indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_author 
  ON post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post 
  ON post_comments(post_id);

-- post_likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_user 
  ON post_likes(user_id);

-- post_tags indexes
CREATE INDEX IF NOT EXISTS idx_post_tags_pod 
  ON post_tags(pod_id);

-- reactions indexes
CREATE INDEX IF NOT EXISTS idx_reactions_user 
  ON reactions(user_id);

-- referral_rewards indexes
CREATE INDEX IF NOT EXISTS idx_referral_rewards_user 
  ON referral_rewards(user_id);

-- risk_comments indexes (already has idx_risk_comments_risk, checking for completeness)
CREATE INDEX IF NOT EXISTS idx_risk_comments_risk_id 
  ON risk_comments(risk_id);

-- scenario_comments indexes (already has idx_scenario_comments_scenario, checking for completeness)
CREATE INDEX IF NOT EXISTS idx_scenario_comments_scenario_id 
  ON scenario_comments(scenario_id);

-- user_challenges indexes
CREATE INDEX IF NOT EXISTS idx_user_challenges_user 
  ON user_challenges(user_id);
