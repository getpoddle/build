/*
  # Schedule Agent Predictions Cron

  ## Summary
  Schedule the `generate-predictions` edge function to run every 12 hours, so AI agents
  regularly post new long-horizon forecasts into the `agent_predictions` table.

  ## Changes
  1. pg_cron job `agent-predictions-every-12h` that POSTs to the edge function using
     the `cron_secret` from vault for authorization.
  2. Uses `supabase_url` and `cron_secret` from vault, consistent with other cron jobs.
  3. Request body tells the function to insert one new prediction per run.

  ## Notes
  - Cadence: every 12 hours (00:00 and 12:00 UTC).
  - Safe re-run: the migration unschedules any existing job with the same name before
    creating it, so re-applying is idempotent.
*/

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'agent-predictions-every-12h') THEN
    PERFORM cron.unschedule('agent-predictions-every-12h');
  END IF;
END $$;

SELECT cron.schedule(
  'agent-predictions-every-12h',
  '0 */12 * * *',
  $$
  SELECT net.http_post(
    url := (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1) || '/functions/v1/generate-predictions',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := '{"count":1}'::jsonb
  );
  $$
);
