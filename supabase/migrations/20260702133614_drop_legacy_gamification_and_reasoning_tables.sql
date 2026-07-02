-- =============================================================================
-- Legacy Gamification + Reasoning-Entity Schema Cleanup (Wave 2)
-- Follows migration 20260702131635_drop_legacy_b2c_social_tables.sql
-- =============================================================================
-- All 13 tables verified 2026-07-02:
--   • Zero .from("table") calls in src/ or supabase/functions/ for 9 of them.
--   • 4 have references only in dead code paths:
--       challenge_ai_replies — ai-agents "challenge-reply" action; that dispatch
--         branch is being removed in the same commit since challenges itself has
--         no callers and is also being dropped.
--       ideas / problems / predictions — generate-sitemap queried these to build
--         /reasoning/... URLs that no longer exist in the app (the Reasoning
--         Entities system was removed in migration 20260618134302); generates
--         only broken sitemap entries. Those queries are removed in the same
--         commit.
--   • FK check: none of these 13 tables is referenced as an FK target by any
--     table that is being kept. (DB query returned zero rows.)
--     CASCADE handles intra-group FKs (e.g. challenge_responses → challenges).
--
-- Tables dropped:
--   challenges              — no callers; parent of the challenge group
--   challenge_responses     — gamification feature, no callers
--   challenge_votes         — gamification feature, no callers
--   challenge_mentions      — gamification feature, no callers
--   challenge_ai_replies    — dead code path in ai-agents (removed alongside)
--   achievements            — removed in migration 20260130221810, table orphaned
--   user_achievements       — child of achievements, no callers
--   insight_events          — insight-score system removed, no callers
--   insight_likes           — insight-score system removed, no callers
--   predictions             — Reasoning Entities system removed, dead sitemap ref
--   ideas                   — Reasoning Entities system removed, dead sitemap ref
--   user_reputation         — no callers; complementary to removed systems
--   problems                — Reasoning Entities system removed, dead sitemap ref
-- =============================================================================

DROP TABLE IF EXISTS public.challenge_ai_replies  CASCADE;
DROP TABLE IF EXISTS public.challenge_votes       CASCADE;
DROP TABLE IF EXISTS public.challenge_mentions    CASCADE;
DROP TABLE IF EXISTS public.challenge_responses   CASCADE;
DROP TABLE IF EXISTS public.challenges            CASCADE;

DROP TABLE IF EXISTS public.user_achievements     CASCADE;
DROP TABLE IF EXISTS public.achievements          CASCADE;

DROP TABLE IF EXISTS public.insight_likes         CASCADE;
DROP TABLE IF EXISTS public.insight_events        CASCADE;

DROP TABLE IF EXISTS public.predictions           CASCADE;
DROP TABLE IF EXISTS public.ideas                 CASCADE;
DROP TABLE IF EXISTS public.problems              CASCADE;

DROP TABLE IF EXISTS public.user_reputation       CASCADE;
