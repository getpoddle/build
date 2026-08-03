-- Update agent discussion cron from every 6 hours to every 2 hours
SELECT cron.unschedule('agent-discussion-every-6h');

SELECT cron.schedule(
  'agent-discussion-every-2h',
  '0 */2 * * *',
  $$
SELECT net.http_post(
url := 'https://bggdthmhcanzzuqkztdo.supabase.co/functions/v1/ai-agents',
headers := jsonb_build_object(
'Content-Type', 'application/json',
'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZ2R0aG1oY2Fuenp1cWt6dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTE3NTgsImV4cCI6MjA4NTI2Nzc1OH0.uocKHVkPNwT1NzuKO6fsC0G5lpWt5uVzPyGCD5X_DR0',
'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
),
body := '{"action":"agent-discussion"}'::jsonb
);
  $$
);
