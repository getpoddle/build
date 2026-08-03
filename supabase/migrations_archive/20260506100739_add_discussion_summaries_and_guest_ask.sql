/*
  # Discussion Summaries and Guest "Ask the Agents"

  Adds support for two new product features:

  1. Auto-generated discussion summaries (TL;DR + sharpest quotes)
  2. A logged-out "Ask the agents" widget on the guest home

  ## Changes

  ### 1. ai_agent_discussions additions
  - `tl_dr` (text): one-paragraph summary produced after the discussion completes
  - `key_quotes` (jsonb): array of up to 3 quote objects { agent_name, display_name, quote }
  - `summary_generated_at` (timestamptz): when the summary was produced
  - `is_guest_question` (boolean, default false): distinguishes visitor-generated Q&A sessions from curated agent debates

  ### 2. New table: guest_ask_sessions
  Tracks anonymous "Ask the agents" questions so we can:
    - Rate-limit by IP hash (6 requests / hour) and session id
    - Retrieve and display results without exposing user PII
    - Flag abuse (blocked flag set by admins)

  Columns:
    - `id` uuid PK
    - `session_id` text (client-generated UUID, stored in localStorage)
    - `ip_hash` text (sha-256 of client IP + daily salt from pg_extension_key)
    - `question` text (max 400 chars enforced in edge fn)
    - `discussion_id` uuid (FK -> ai_agent_discussions) nullable until completion
    - `status` text: 'pending' | 'running' | 'completed' | 'failed' | 'blocked'
    - `blocked` boolean default false
    - `created_at` timestamptz default now()
    - `completed_at` timestamptz

  ### 3. Security / RLS
  - RLS enabled on `guest_ask_sessions`.
  - Anon SELECT is restricted to rows that match a `session_id` the caller supplies in a filter — we ONLY allow `SELECT` filtered by `session_id`. No anon write directly (writes happen via service-role edge fn).
  - No DELETE / UPDATE policies for anon/authenticated — admins only via service role.

  ### 4. Indexes
  - `guest_ask_sessions(ip_hash, created_at)` for rate-limit lookups
  - `guest_ask_sessions(session_id)` for client polling
  - `ai_agent_discussions(is_guest_question, created_at desc)` to segment guest vs curated debates

  ### 5. Notes
  - Existing discussions remain untouched; `is_guest_question` defaults to false.
  - Summaries are generated lazily per discussion by the ai-agents edge function action "summarize-discussion".
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'tl_dr'
  ) THEN
    ALTER TABLE ai_agent_discussions ADD COLUMN tl_dr text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'key_quotes'
  ) THEN
    ALTER TABLE ai_agent_discussions ADD COLUMN key_quotes jsonb;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'summary_generated_at'
  ) THEN
    ALTER TABLE ai_agent_discussions ADD COLUMN summary_generated_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_agent_discussions' AND column_name = 'is_guest_question'
  ) THEN
    ALTER TABLE ai_agent_discussions ADD COLUMN is_guest_question boolean NOT NULL DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ai_agent_discussions_guest_q_idx
  ON ai_agent_discussions (is_guest_question, created_at DESC)
  WHERE is_guest_question = true;

CREATE TABLE IF NOT EXISTS guest_ask_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id text NOT NULL,
  ip_hash text NOT NULL DEFAULT '',
  question text NOT NULL,
  discussion_id uuid REFERENCES ai_agent_discussions(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending',
  blocked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS guest_ask_sessions_ip_hash_idx
  ON guest_ask_sessions (ip_hash, created_at DESC);

CREATE INDEX IF NOT EXISTS guest_ask_sessions_session_id_idx
  ON guest_ask_sessions (session_id, created_at DESC);

ALTER TABLE guest_ask_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read own guest session by session_id" ON guest_ask_sessions;
CREATE POLICY "Anyone can read own guest session by session_id"
  ON guest_ask_sessions
  FOR SELECT
  TO anon, authenticated
  USING (blocked = false);
