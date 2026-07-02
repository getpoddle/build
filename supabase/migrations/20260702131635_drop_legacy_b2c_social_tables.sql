-- =============================================================================
-- Legacy B2C Social-Network Schema Cleanup
-- =============================================================================
-- Poddle pivoted from an AI-agent social network to a B2B decision-intelligence
-- platform. The tables below were part of the original social/gamification
-- model and are no longer referenced anywhere in src/ or supabase/functions/.
--
-- Verification performed 2026-07-02:
--   - Searched every file in src/ and supabase/functions/ for .from("table")
--   - Confirmed no UI routes, components, or edge functions reference these tables
--   - Confirmed FK dependencies: none of these are referenced BY other kept tables
--
-- Tables removed and why:
--   post_attachments          — attachment feature never shipped; no src refs
--   challenge_response_mentions — challenges system removed; no src refs
--   learning_paths            — learning-path system removed (migration 20260130215158)
--   learning_path_items       — child of learning_paths
--   learning_path_progress    — child of learning_path_items
--   marketplace_items         — marketplace feature removed; no src refs
--   referral_codes            — referral code UI removed; no src .from() calls;
--                               no other table holds a FK pointing to this table
--   referral_rewards          — reward side of referral; no src refs;
--                               FKs *to* referral_signups (kept), not from it
--   user_challenge_streaks    — challenges system removed; no src refs
--   user_stats                — legacy gamification stats; no src refs
--
-- Tables intentionally KEPT (still referenced in src/):
--   posts, post_comments, post_likes, post_comment_ai_replies — active feed
--   followers          — active follow system (FollowButton, WhoToFollow, etc.)
--   comments           — admin stats query (Admin.tsx:104)
--   referral_signups   — still inserted on signup (AuthContext.tsx:181)
-- =============================================================================

-- Drop in dependency order (children before parents), CASCADE handles remaining FKs

DROP TABLE IF EXISTS public.learning_path_progress CASCADE;
DROP TABLE IF EXISTS public.learning_path_items CASCADE;
DROP TABLE IF EXISTS public.learning_paths CASCADE;

DROP TABLE IF EXISTS public.post_attachments CASCADE;
DROP TABLE IF EXISTS public.challenge_response_mentions CASCADE;
DROP TABLE IF EXISTS public.marketplace_items CASCADE;
DROP TABLE IF EXISTS public.referral_rewards CASCADE;
DROP TABLE IF EXISTS public.referral_codes CASCADE;
DROP TABLE IF EXISTS public.user_challenge_streaks CASCADE;
DROP TABLE IF EXISTS public.user_stats CASCADE;
