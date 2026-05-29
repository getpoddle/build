/*
  # Add Performance Indexes

  1. Performance Improvements
    - Add indexes on all foreign key columns for faster joins and queries
    - Add composite indexes for common query patterns
    - Significantly improves query performance for user-specific data
  
  2. Indexes Added
    - user_skills: index on user_id
    - user_interests: index on user_id
    - pod_members: indexes on user_id, pod_id, and composite (pod_id, user_id)
    - insights: indexes on pod_id, author_id, and created_at
    - reactions: composite index on (insight_id, user_id)
    - comments: index on insight_id and author_id
*/

-- User skills index for faster user profile queries
CREATE INDEX IF NOT EXISTS idx_user_skills_user_id ON user_skills(user_id);

-- User interests index for faster user profile queries
CREATE INDEX IF NOT EXISTS idx_user_interests_user_id ON user_interests(user_id);

-- User challenges index for faster user profile queries
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON user_challenges(user_id);

-- Pod members indexes for faster membership checks and pod listings
CREATE INDEX IF NOT EXISTS idx_pod_members_user_id ON pod_members(user_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_pod_id ON pod_members(pod_id);
CREATE INDEX IF NOT EXISTS idx_pod_members_pod_user ON pod_members(pod_id, user_id);

-- Insights indexes for faster pod detail and user profile queries
CREATE INDEX IF NOT EXISTS idx_insights_pod_id ON insights(pod_id);
CREATE INDEX IF NOT EXISTS idx_insights_author_id ON insights(author_id);
CREATE INDEX IF NOT EXISTS idx_insights_created_at ON insights(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_pod_created ON insights(pod_id, created_at DESC);

-- Reactions indexes for faster reaction checks and counts
CREATE INDEX IF NOT EXISTS idx_reactions_insight_id ON reactions(insight_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_reactions_insight_user ON reactions(insight_id, user_id);

-- Comments indexes for faster comment loading
CREATE INDEX IF NOT EXISTS idx_comments_insight_id ON comments(insight_id);
CREATE INDEX IF NOT EXISTS idx_comments_author_id ON comments(author_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at);
