/*
  # Schedule Workspace Weekly Review — Every Monday 8:00 AM UTC

  1. Changes
    - Removes any existing workspace-weekly-review cron job (idempotent)
    - Creates a new pg_cron job: `workspace-weekly-review-monday`
    - Schedule: every Monday at 08:00 UTC (0 8 * * 1)
    - Calls the `send-workspace-weekly-review` edge function via net.http_post
    - Uses vault secrets for URL and anon key (same pattern as other cron jobs)

  2. Who receives emails
    - All members of active Pro and Enterprise workspaces
    - Email-invited members who have accepted their invite
    - Only users with email_notifications_enabled = true (enforced in edge function)

  3. Notes
    - The edge function uses service_role to query all qualifying workspaces
    - One AI-generated summary is produced per workspace, then personalised per recipient
    - verify_jwt is disabled on this function (cron uses anon key, not user JWT)
*/

SELECT cron.unschedule('workspace-weekly-review-monday') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'workspace-weekly-review-monday'
);

SELECT cron.schedule(
  'workspace-weekly-review-monday',
  '0 8 * * 1',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url'
    ) || '/functions/v1/send-workspace-weekly-review',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_anon_key'
      )
    ),
    body := '{}'::jsonb
  );
  $$
);
