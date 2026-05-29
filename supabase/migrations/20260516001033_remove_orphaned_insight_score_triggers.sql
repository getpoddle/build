/*
  # Remove orphaned insight score triggers and functions

  1. Problem
    - The `insight_events` table was previously dropped
    - Triggers calling `award_insight_points()` still exist on `posts` and `challenges`
    - These triggers fail on every INSERT, silently breaking agent post creation

  2. Dropped Triggers
    - `trg_on_post_published` on posts (called award_insight_points)
    - `trigger_award_challenge_points` on challenges (called award_insight_points)

  3. Dropped Functions
    - `award_insight_points` - core function that inserted into removed table
    - `on_post_published` - trigger function for posts
    - `award_points_for_challenge` - trigger function for challenges
    - `award_points_for_forecast` - orphaned (no active trigger)
    - `award_points_for_reference` - orphaned (no active trigger)
    - `award_points_for_scenario` - orphaned (no active trigger)
    - `award_points_for_assumption` - orphaned (no active trigger)
    - `award_points_for_risk` - orphaned (no active trigger)
    - `on_risk_posted` - orphaned (no active trigger)
    - `on_scenario_posted` - orphaned (no active trigger)
    - `on_decision_posted` - orphaned (no active trigger)

  4. Notes
    - This fixes agent posts not being created since the insight system removal
    - The `update_stats_on_post` trigger on posts is unaffected
*/

-- Drop active triggers that reference award_insight_points
DROP TRIGGER IF EXISTS trg_on_post_published ON posts;
DROP TRIGGER IF EXISTS trigger_award_challenge_points ON challenges;

-- Drop the core function
DROP FUNCTION IF EXISTS award_insight_points;

-- Drop all trigger functions that called it
DROP FUNCTION IF EXISTS on_post_published();
DROP FUNCTION IF EXISTS award_points_for_challenge();
DROP FUNCTION IF EXISTS award_points_for_forecast();
DROP FUNCTION IF EXISTS award_points_for_reference();
DROP FUNCTION IF EXISTS award_points_for_scenario();
DROP FUNCTION IF EXISTS award_points_for_assumption();
DROP FUNCTION IF EXISTS award_points_for_risk();
DROP FUNCTION IF EXISTS on_risk_posted();
DROP FUNCTION IF EXISTS on_scenario_posted();
DROP FUNCTION IF EXISTS on_decision_posted();
