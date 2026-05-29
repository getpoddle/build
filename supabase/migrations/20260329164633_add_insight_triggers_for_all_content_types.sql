
/*
  # Add insight score triggers for all content types

  ## Summary
  Previously only assumptions, forecasts, challenges, and references awarded
  insight points. Risks, scenarios, decisions, and posts were untracked, making
  the leaderboard skewed toward those types. This migration adds triggers for
  every remaining content type and creates a contributor_leaderboard view that
  surfaces ranked contributions across all types.

  ## New triggers
  - risk_posted (assumption_risks) → 10 points
  - scenario_posted (assumption_scenarios) → 10 points
  - decision_posted (decision_threads) → 15 points
  - post_published (posts) → 5 points

  ## New view: contributor_leaderboard
  Joins user_reputation with per-type contribution counts for rich leaderboard display.

  ## Notes
  - Existing rows are backfilled where the user has no prior insight event for
    that contribution (prevents double-awarding on re-run)
  - All PERFORM calls use explicit ::text casts to avoid function overload ambiguity
*/

-- ─── Risk trigger ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_risk_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_insight_points(NEW.created_by, 'risk_posted'::text, 10, NEW.id, 'risk'::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_risk_posted ON assumption_risks;
CREATE TRIGGER trg_on_risk_posted
  AFTER INSERT ON assumption_risks
  FOR EACH ROW
  EXECUTE FUNCTION public.on_risk_posted();

-- ─── Scenario trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_scenario_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_insight_points(NEW.created_by, 'scenario_posted'::text, 10, NEW.id, 'scenario'::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_scenario_posted ON assumption_scenarios;
CREATE TRIGGER trg_on_scenario_posted
  AFTER INSERT ON assumption_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION public.on_scenario_posted();

-- ─── Decision trigger ─────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_decision_posted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_insight_points(NEW.created_by, 'decision_posted'::text, 15, NEW.id, 'decision'::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_decision_posted ON decision_threads;
CREATE TRIGGER trg_on_decision_posted
  AFTER INSERT ON decision_threads
  FOR EACH ROW
  EXECUTE FUNCTION public.on_decision_posted();

-- ─── Post trigger ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.on_post_published()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM award_insight_points(NEW.author_id, 'post_published'::text, 5, NEW.id, 'post'::text);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_on_post_published ON posts;
CREATE TRIGGER trg_on_post_published
  AFTER INSERT ON posts
  FOR EACH ROW
  EXECUTE FUNCTION public.on_post_published();

-- ─── Backfill existing risks ──────────────────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT ar.id, ar.created_by
    FROM assumption_risks ar
    WHERE ar.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM insight_events ie
        WHERE ie.contribution_id = ar.id AND ie.event_type = 'risk_posted'
      )
  LOOP
    PERFORM award_insight_points(r.created_by, 'risk_posted'::text, 10, r.id, 'risk'::text);
  END LOOP;
END $$;

-- ─── Backfill existing scenarios ─────────────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT s.id, s.created_by
    FROM assumption_scenarios s
    WHERE s.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM insight_events ie
        WHERE ie.contribution_id = s.id AND ie.event_type = 'scenario_posted'
      )
  LOOP
    PERFORM award_insight_points(r.created_by, 'scenario_posted'::text, 10, r.id, 'scenario'::text);
  END LOOP;
END $$;

-- ─── Backfill existing decisions ─────────────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT dt.id, dt.created_by
    FROM decision_threads dt
    WHERE dt.created_by IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM insight_events ie
        WHERE ie.contribution_id = dt.id AND ie.event_type = 'decision_posted'
      )
  LOOP
    PERFORM award_insight_points(r.created_by, 'decision_posted'::text, 15, r.id, 'decision'::text);
  END LOOP;
END $$;

-- ─── Backfill existing posts ──────────────────────────────────────────────────

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.id, p.author_id
    FROM posts p
    WHERE p.author_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM insight_events ie
        WHERE ie.contribution_id = p.id AND ie.event_type = 'post_published'
      )
  LOOP
    PERFORM award_insight_points(r.author_id, 'post_published'::text, 5, r.id, 'post'::text);
  END LOOP;
END $$;

-- ─── Contributor leaderboard view ─────────────────────────────────────────────

CREATE OR REPLACE VIEW contributor_leaderboard AS
SELECT
  ur.user_id,
  ur.insight_score,
  ur.total_contributions,
  COALESCE(SUM(CASE WHEN ie.event_type = 'assumption_posted'  THEN 1 END), 0) AS assumptions_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'forecast_added'     THEN 1 END), 0) AS forecasts_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'challenge_posted'   THEN 1 END), 0) AS challenges_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'risk_posted'        THEN 1 END), 0) AS risks_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'scenario_posted'    THEN 1 END), 0) AS scenarios_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'decision_posted'    THEN 1 END), 0) AS decisions_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'post_published'     THEN 1 END), 0) AS posts_count,
  COALESCE(SUM(CASE WHEN ie.event_type = 'reference_added'    THEN 1 END), 0) AS references_count
FROM user_reputation ur
LEFT JOIN insight_events ie ON ie.user_id = ur.user_id
GROUP BY ur.user_id, ur.insight_score, ur.total_contributions;
