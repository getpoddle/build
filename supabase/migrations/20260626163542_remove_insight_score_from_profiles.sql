-- Remove the insight_score column from profiles.
-- The insight score system was removed (see 20260515224555_remove_pods_decisions_insight_scores.sql)
-- but the column was left behind. This cleans it up completely.

DROP INDEX IF EXISTS idx_profiles_insight_score;

ALTER TABLE profiles DROP COLUMN IF EXISTS insight_score;
