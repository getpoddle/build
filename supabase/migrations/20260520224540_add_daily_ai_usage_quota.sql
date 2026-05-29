/*
  # Daily AI Usage Quota Table

  1. New Tables
    - `daily_ai_usage`
      - `user_id` (uuid, FK profiles) — workspace member being tracked
      - `date` (date) — UTC calendar date of usage
      - `message_count` (integer) — number of AI chat messages sent today
      - Primary key: (user_id, date) — one row per user per day

  2. Purpose
    - Prevents a single authenticated user from sending unbounded messages to
      workspace-ai-chat, which triggers 3 parallel OpenAI API calls per message.
    - Enforced atomically via upsert + check inside the Edge Function.

  3. Security
    - RLS enabled; users can only read their own row.
    - Writes are done via service-role client inside the Edge Function.
*/

CREATE TABLE IF NOT EXISTS daily_ai_usage (
  user_id    uuid    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date       date    NOT NULL DEFAULT CURRENT_DATE,
  message_count integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);

ALTER TABLE daily_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily usage"
  ON daily_ai_usage FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);
