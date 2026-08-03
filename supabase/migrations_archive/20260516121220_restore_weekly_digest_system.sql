/*
  # Restore weekly digest email system

  1. Recreated Tables
    - `weekly_digests` - stores generated digest data per user per week

  2. Recreated Functions
    - `get_digest_recipients()` - returns users eligible for digest emails

  3. Cron Job
    - `weekly-digest-saturday` - runs every Saturday at 8 AM UTC, calls send-weekly-digest edge function

  4. Security
    - RLS enabled on weekly_digests
    - Users can only read/insert/update their own digest records
*/

CREATE TABLE IF NOT EXISTS weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  top_assumptions jsonb NOT NULL DEFAULT '[]',
  ai_highlights jsonb NOT NULL DEFAULT '[]',
  pod_changes jsonb NOT NULL DEFAULT '[]',
  agent_posts jsonb NOT NULL DEFAULT '[]',
  summary_text text NOT NULL DEFAULT '',
  week_start date NOT NULL,
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_weekly_digests_user_id ON weekly_digests(user_id);
CREATE INDEX IF NOT EXISTS idx_weekly_digests_generated_at ON weekly_digests(generated_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_digests_user_week ON weekly_digests(user_id, week_start);

ALTER TABLE weekly_digests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own weekly digest"
  ON weekly_digests FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own weekly digest"
  ON weekly_digests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own weekly digest"
  ON weekly_digests FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Function to get digest recipients
CREATE OR REPLACE FUNCTION public.get_digest_recipients()
RETURNS TABLE (
  user_id uuid,
  email text,
  first_name text,
  full_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.id AS user_id,
    au.email,
    p.first_name,
    p.full_name
  FROM auth.users au
  JOIN profiles p ON p.id = au.id
  WHERE p.email_notifications_enabled = true
    AND au.email IS NOT NULL
    AND au.email NOT LIKE '%@anonymous.local'
    AND au.email NOT LIKE 'testuser%'
  ORDER BY au.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_digest_recipients() TO service_role;

-- Schedule the cron job for every Saturday at 8 AM UTC
SELECT cron.schedule(
  'weekly-digest-saturday',
  '0 8 * * 6',
  $$
  SELECT net.http_post(
    url := (
      SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_url'
    ) || '/functions/v1/send-weekly-digest',
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
