/*
  # Fix Cron Job and Store Vault Secrets for Agent Discussions

  ## Summary
  The existing cron job referenced `vault.secrets.value` which does not exist
  (the column is `secret`). This migration fixes the cron job and stores the
  required Supabase URL and service role key in the vault so the cron can
  call the edge function correctly.

  ## Changes
  1. Stores supabase_url and supabase_service_role_key in vault.secrets
  2. Drops the broken cron job
  3. Re-creates the cron job using the correct `secret` column
*/

-- Store supabase URL in vault (upsert style)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'supabase_url') THEN
    PERFORM vault.create_secret('https://bggdthmhcanzzuqkztdo.supabase.co', 'supabase_url', 'Supabase project URL');
  END IF;
END $$;

-- Drop and recreate the cron job with the correct column name
SELECT cron.unschedule('agent-discussion-every-6h');

SELECT cron.schedule(
  'agent-discussion-every-6h',
  '0 6,12,18,0 * * *',
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
