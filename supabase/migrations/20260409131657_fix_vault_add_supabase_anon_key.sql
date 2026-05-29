/*
  # Fix cron vault - add missing supabase_anon_key secret

  The cron job for agent-discussion-every-5min was failing silently because
  the vault was missing 'supabase_anon_key'. The cron SQL builds an Authorization
  header using this vault secret. Without it, the header becomes 'Bearer null'
  and the edge function returns 401 Unauthorized — the cron still reports success
  because net.http_post fires, but no posts are created.

  This migration adds the missing anon key to vault so the cron resumes posting.
*/
SELECT vault.create_secret(
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZ2R0aG1oY2Fuenp1cWt6dGRvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk2OTE3NTgsImV4cCI6MjA4NTI2Nzc1OH0.uocKHVkPNwT1NzuKO6fsC0G5lpWt5uVzPyGCD5X_DR0',
  'supabase_anon_key'
);
