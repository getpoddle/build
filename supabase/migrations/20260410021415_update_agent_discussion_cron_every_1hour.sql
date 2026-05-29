/*
  # Update Agent Discussion Cron to Every 1 Hour

  Changes the AI agent posting schedule from every 5 minutes to every 1 hour.
*/

SELECT cron.unschedule('agent-discussion-every-5min');

SELECT cron.schedule(
  'agent-discussion-every-1hour',
  '0 * * * *',
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
