/*
  # Schedule Weekly Digest Cron Job

  1. Enables the pg_cron extension
  2. Schedules the send-weekly-digest edge function to run every Saturday at 8:00 AM UTC
  3. Uses pg_net to make an HTTP POST to the edge function
*/

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;

SELECT cron.schedule(
  'weekly-digest-saturday',
  '0 8 * * 6',
  $$
  SELECT net.http_post(
    url := (
      SELECT 'https://bggdthmhcanzzuqkztdo.supabase.co/functions/v1/send-weekly-digest'
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZ2R0aG1oY2Fuenp1cWt6dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTE3NTgsImV4cCI6MjA4NTI2Nzc1OH0.uocKHVkPNwT1NzuKO6fsC0G5lpWt5uVzPyGCD5X_DR0'
    ),
    body := '{}'::jsonb
  );
  $$
);
