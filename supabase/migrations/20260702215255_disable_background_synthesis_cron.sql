-- Unschedule the background synthesis cron that was causing continuous
-- re-synthesis even when users haven't made changes. Synthesis is now
-- triggered explicitly by the user clicking "Run War Room".

SELECT cron.unschedule('process-synthesis-queue')
WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'process-synthesis-queue'
);

-- Delete stuck pending/running entries (can't UPDATE to done due to unique constraint
-- on (workspace_id, status) — a done row already exists for some workspaces).
DELETE FROM workspace_synthesis_queue
WHERE status IN ('pending', 'running');
