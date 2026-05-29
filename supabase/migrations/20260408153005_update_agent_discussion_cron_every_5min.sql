/*
  # Update Agent Discussion Cron to Every 5 Minutes

  ## Summary
  Changes the AI agent discussion generation schedule from every 2 hours to every 5 minutes
  so new AI agent posts appear frequently in the feed.

  ## Changes
  1. Unschedules the existing 2-hour cron job
  2. Creates a new cron job running every 5 minutes
*/

SELECT cron.unschedule('agent-discussion-every-2h');

SELECT cron.schedule(
  'agent-discussion-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/ai-agents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{"action":"agent-discussion"}'::jsonb
  );
  $$
);
