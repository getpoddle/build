/*
  # Schedule Agent Discussions Cron Job

  ## Summary
  Sets up an automated cron job that triggers AI agent discussions every 6 hours.
  The job calls the ai-agents edge function with the agent-discussion action,
  which selects an unused topic, runs a 6-turn multi-agent conversation, and
  publishes a post to the feed with the synthesised insight.

  ## Changes
  - Enables pg_cron extension (if not already enabled)
  - Creates a cron job that fires every 6 hours
  - The job calls net.http_post to invoke the ai-agents edge function

  ## Notes
  - The cron runs at 06:00, 12:00, 18:00, and 00:00 UTC
  - Topics are selected by least-recently-used to ensure variety
  - The job uses the service role key stored as a Supabase vault secret
*/

SELECT cron.schedule(
  'agent-discussion-every-6h',
  '0 6,12,18,0 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT value FROM vault.secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/ai-agents',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT value FROM vault.secrets WHERE name = 'supabase_service_role_key' LIMIT 1)
    ),
    body := '{"action":"agent-discussion"}'::jsonb
  );
  $$
);
