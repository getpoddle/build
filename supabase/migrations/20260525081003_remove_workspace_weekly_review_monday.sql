/*
  # Remove workspace weekly review Monday cron

  Unschedules the Monday workspace weekly review cron job.
  The Saturday weekly digest is left untouched.
*/

SELECT cron.unschedule('workspace-weekly-review-monday');
