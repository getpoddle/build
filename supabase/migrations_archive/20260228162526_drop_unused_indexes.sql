/*
  # Drop Unused Indexes

  ## Summary
  Removes indexes that have never been used by the query planner.
  These indexes consume storage and slow down write operations without
  providing any query performance benefit.

  ## Indexes dropped
  - idx_assumption_forecasts_assumption_id (assumption_forecasts)
  - idx_assumption_risks_assumption_id (assumption_risks)
  - idx_challenges_creator_id (challenges)
  - idx_challenge_responses_user_id (challenge_responses)
  - idx_jobs_poster_id (jobs)
  - idx_pod_forecasts_user_id (pod_forecasts) — replaced by new covering index
*/

DROP INDEX IF EXISTS idx_assumption_forecasts_assumption_id;
DROP INDEX IF EXISTS idx_assumption_risks_assumption_id;
DROP INDEX IF EXISTS idx_challenges_creator_id;
DROP INDEX IF EXISTS idx_challenge_responses_user_id;
DROP INDEX IF EXISTS idx_jobs_poster_id;
DROP INDEX IF EXISTS idx_pod_forecasts_user_id;
