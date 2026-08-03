/*
  # Remove Unused Indexes

  This migration addresses security recommendations by removing unused indexes.
  
  1. **Performance Improvements**
     - Drops 20 unused indexes across multiple tables
     - Improves write performance by reducing index maintenance overhead
     - Reduces storage usage
     - Indexes can be recreated later if usage patterns change
  
  2. **Tables Affected**
     - comment_mentions: 3 indexes removed
     - marketplace_items: 3 indexes removed  
     - followers: 1 index removed
     - messages: 1 index removed
     - reactions: 1 index removed
     - user_challenges: 1 index removed
     - pods: 1 index removed
     - post_tags: 2 indexes removed
     - post_attachments: 2 indexes removed
     - post_comments: 3 indexes removed
     - post_likes: 2 indexes removed
*/

-- Drop unused indexes on comment_mentions
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_user;
DROP INDEX IF EXISTS idx_comment_mentions_comment;
DROP INDEX IF EXISTS idx_comment_mentions_mentioned_by_user;

-- Drop unused indexes on marketplace_items
DROP INDEX IF EXISTS idx_marketplace_items_seller_id;
DROP INDEX IF EXISTS idx_marketplace_items_category;
DROP INDEX IF EXISTS idx_marketplace_items_created_at;

-- Drop unused indexes on followers
DROP INDEX IF EXISTS idx_followers_follower_id;

-- Drop unused indexes on messages
DROP INDEX IF EXISTS idx_messages_sender_id;

-- Drop unused indexes on reactions
DROP INDEX IF EXISTS idx_reactions_user_id;

-- Drop unused indexes on user_challenges
DROP INDEX IF EXISTS idx_user_challenges_user_id;

-- Drop unused indexes on pods
DROP INDEX IF EXISTS idx_pods_share_token;

-- Drop unused indexes on post_tags
DROP INDEX IF EXISTS idx_post_tags_post_id;
DROP INDEX IF EXISTS idx_post_tags_pod_id;

-- Drop unused indexes on post_attachments
DROP INDEX IF EXISTS idx_post_attachments_post_id;
DROP INDEX IF EXISTS idx_post_attachments_post_comment_id;

-- Drop unused indexes on post_comments
DROP INDEX IF EXISTS idx_post_comments_post_id;
DROP INDEX IF EXISTS idx_post_comments_author_id;
DROP INDEX IF EXISTS idx_post_comments_created_at;

-- Drop unused indexes on post_likes
DROP INDEX IF EXISTS idx_post_likes_post_id;
DROP INDEX IF EXISTS idx_post_likes_user_id;