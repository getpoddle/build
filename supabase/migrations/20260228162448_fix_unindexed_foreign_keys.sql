/*
  # Add Missing Foreign Key Indexes

  ## Summary
  Adds covering indexes for all foreign key columns that were missing indexes,
  which improves JOIN and lookup performance significantly.

  ## Tables affected
  - assumption_challenges: user_id
  - assumption_forecasts: user_id
  - assumption_risks: created_by
  - comment_mentions: mentioned_by_user_id, mentioned_user_id
  - learning_path_progress: learning_path_item_id
  - marketplace_items: seller_id
  - messages: sender_id
  - pod_assumptions: created_by
  - pod_options: created_by
  - pod_risks: created_by, option_id
  - post_attachments: post_comment_id, post_id
  - post_comments: author_id, post_id
  - post_likes: user_id
  - post_tags: pod_id
  - reactions: user_id
  - user_challenges: user_id
*/

CREATE INDEX IF NOT EXISTS idx_assumption_challenges_user_id ON public.assumption_challenges(user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_forecasts_user_id ON public.assumption_forecasts(user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_risks_created_by ON public.assumption_risks(created_by);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_by_user_id ON public.comment_mentions(mentioned_by_user_id);
CREATE INDEX IF NOT EXISTS idx_comment_mentions_mentioned_user_id ON public.comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_learning_path_progress_item_id ON public.learning_path_progress(learning_path_item_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_seller_id ON public.marketplace_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_pod_assumptions_created_by ON public.pod_assumptions(created_by);
CREATE INDEX IF NOT EXISTS idx_pod_options_created_by ON public.pod_options(created_by);
CREATE INDEX IF NOT EXISTS idx_pod_risks_created_by ON public.pod_risks(created_by);
CREATE INDEX IF NOT EXISTS idx_pod_risks_option_id ON public.pod_risks(option_id);
CREATE INDEX IF NOT EXISTS idx_post_attachments_post_comment_id ON public.post_attachments(post_comment_id);
CREATE INDEX IF NOT EXISTS idx_post_attachments_post_id ON public.post_attachments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_author_id ON public.post_comments(author_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_post_tags_pod_id ON public.post_tags(pod_id);
CREATE INDEX IF NOT EXISTS idx_reactions_user_id ON public.reactions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenges_user_id ON public.user_challenges(user_id);
