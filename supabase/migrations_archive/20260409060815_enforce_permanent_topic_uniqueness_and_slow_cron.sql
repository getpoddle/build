/*
  # Enforce Permanent Topic Uniqueness and Reduce Posting Frequency

  ## Summary
  The agent posting system was running every 5 minutes (288 posts/day) causing feed congestion
  and topic repetition. This migration:

  1. Adds `used` boolean column to agent_topics — once a topic is posted, it is permanently
     marked used and never selected again. This is the only way to guarantee zero repetition.
  2. Marks all previously-posted topics as used (backfill from existing posts)
  3. Changes the cron from every 5 minutes to 3 times per day (08:00, 14:00, 20:00 UTC)
  4. Updates agent_topics so that only breakthrough_idea and industry_problem types remain
     eligible — opinion posts are deprioritised (post_type filter applied at selection time)
*/

ALTER TABLE agent_topics
  ADD COLUMN IF NOT EXISTS used boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS used_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_agent_topics_used ON agent_topics (used, is_active);

UPDATE agent_topics t
SET used = true, used_at = p.created_at
FROM (
  SELECT DISTINCT ON (agent_post_title) agent_post_title, MIN(created_at) AS created_at
  FROM posts
  WHERE is_agent_post = true AND agent_post_title IS NOT NULL
  GROUP BY agent_post_title
) p
WHERE t.title = p.agent_post_title;

SELECT cron.unschedule('agent-discussion-every-5min');

SELECT cron.schedule(
  'agent-discussion-3x-daily',
  '0 8,14,20 * * *',
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
