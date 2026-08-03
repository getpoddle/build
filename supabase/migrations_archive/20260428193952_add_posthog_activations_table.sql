/*
  # PostHog activation tracking

  ## Summary
  Adds a small bookkeeping table so first-time activation events
  (e.g. first post created, first pod joined, profile completed) can be fired
  exactly once per user, even if the client retries.

  ## New tables
  - `posthog_activations`
    - `user_id` (uuid, FK -> profiles.id)
    - `event` (text) - activation event name
    - `fired_at` (timestamptz, default now())
    - PRIMARY KEY (user_id, event) for idempotency

  ## Security
  - RLS enabled
  - Users can only read/insert rows for themselves
  - No update or delete policies (rows are append-only ledger)
*/

CREATE TABLE IF NOT EXISTS posthog_activations (
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event text NOT NULL,
  fired_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event)
);

ALTER TABLE posthog_activations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posthog_activations'
      AND policyname = 'Users can view own activations'
  ) THEN
    CREATE POLICY "Users can view own activations"
      ON posthog_activations FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'posthog_activations'
      AND policyname = 'Users can insert own activations'
  ) THEN
    CREATE POLICY "Users can insert own activations"
      ON posthog_activations FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;
