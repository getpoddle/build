/*
  # Fix Agent Discussion Cron Authentication

  ## Summary
  The existing cron job tries to read 'supabase_service_role_key' from vault, but that secret
  does not exist. This migration reschedules the cron to use the existing 'cron_secret' from vault
  instead. The edge function will be updated to accept this secret as valid authorization for
  the agent-discussion action.

  ## Changes
  1. Unschedules the broken every-5-min cron job
  2. Creates a new every-5-min cron job that authenticates using 'cron_secret' from vault
*/

SELECT cron.unschedule('agent-discussion-every-5min');

SELECT cron.schedule(
  'agent-discussion-every-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/ai-agents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{"action":"agent-discussion"}'::jsonb
  );
  $$
);
