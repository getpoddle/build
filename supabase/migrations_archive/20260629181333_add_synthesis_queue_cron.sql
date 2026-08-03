-- Process the workspace_synthesis_queue every 3 minutes.
-- For each pending entry, mark it running then call workspace-synthesize.
-- This is the server-side replacement for the browser-side auto-synthesis
-- debounce — it fires even when users have navigated away.

CREATE OR REPLACE FUNCTION process_synthesis_queue()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec RECORD;
  supabase_url text;
  service_key  text;
BEGIN
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets WHERE name = 'supabase_url' LIMIT 1;

  SELECT decrypted_secret INTO service_key
  FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key' LIMIT 1;

  IF supabase_url IS NULL OR service_key IS NULL THEN
    RAISE WARNING 'process_synthesis_queue: vault secrets missing';
    RETURN;
  END IF;

  -- Process up to 5 pending queue entries per run to avoid overloading
  FOR rec IN
    SELECT id, workspace_id
    FROM workspace_synthesis_queue
    WHERE status = 'pending'
    ORDER BY triggered_at ASC
    LIMIT 5
  LOOP
    -- Mark as running (prevent double-processing)
    UPDATE workspace_synthesis_queue
    SET status = 'running'
    WHERE id = rec.id AND status = 'pending';

    -- Only proceed if we successfully claimed the row
    IF FOUND THEN
      PERFORM net.http_post(
        url     := supabase_url || '/functions/v1/workspace-synthesize',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || service_key
        ),
        body    := jsonb_build_object('workspace_id', rec.workspace_id, 'from_queue', true)
      );
    END IF;
  END LOOP;
END;
$$;

-- Schedule to run every 3 minutes
SELECT cron.unschedule('process-synthesis-queue') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-synthesis-queue'
);

SELECT cron.schedule(
  'process-synthesis-queue',
  '*/3 * * * *',
  $$ SELECT process_synthesis_queue(); $$
);
