/*
  # Update Agent Discussion Cron to Every 5 Minutes

  Changes the AI agent posting schedule from 3x daily back to every 5 minutes.
*/

SELECT cron.unschedule('agent-discussion-3x-daily');

SELECT cron.schedule(
  'agent-discussion-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url') || '/functions/v1/ai-agents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key'),
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret')
    ),
    body := '{"action":"agent-discussion"}'::jsonb
  );
  $$
);
