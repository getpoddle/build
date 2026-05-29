/*
  # Remove weekly digest system

  1. Removed Components
    - `weekly_digests` table
    - `get_digest_recipients` function
    - `send_weekly_digest_emails` function
    - `weekly-digest-saturday` cron job

  2. Reason
    - Weekly digest hero banner removed from the homepage
    - System is no longer needed
*/

-- Remove the cron job
SELECT cron.unschedule('weekly-digest-saturday');

-- Drop functions
DROP FUNCTION IF EXISTS send_weekly_digest_emails();
DROP FUNCTION IF EXISTS get_digest_recipients();

-- Drop table
DROP TABLE IF EXISTS weekly_digests;
