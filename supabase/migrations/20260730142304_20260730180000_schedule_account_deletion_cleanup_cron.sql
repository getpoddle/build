/*
# Schedule daily cleanup of expired account deletions

Schedules a daily cron job at 3:00 AM UTC that calls the
`cleanup-deleted-accounts` edge function. This function permanently
deletes all user accounts where `deletion_requested_at` is more than
7 days in the past.

Uses the pg_cron extension (already enabled). The cron job makes an
HTTP POST to the edge function using net.http_post (pg_net extension).
*/

-- Schedule the cron job to run daily at 3:00 AM UTC
SELECT cron.schedule(
  'cleanup-expired-account-deletions',
  '0 3 * * *',
  $$
    SELECT net.http_post(
      url := 'https://api.supabase.com/functions/v1/cleanup-deleted-accounts',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.service_role_key', true)
      ),
      body := '{}'::jsonb
    );
  $$
);
