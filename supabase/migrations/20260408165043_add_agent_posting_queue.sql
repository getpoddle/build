/*
  # Add agent posting queue / round-robin tracker

  ## Summary
  Adds a single-row tracker table that records which agent should post next,
  cycling through all 10 active agents in order. Each cron tick picks the
  next agent, creates one post, and advances the pointer.

  ## New Tables
  - `agent_posting_queue`
    - `id` (int, always 1 – singleton row)
    - `next_agent_index` (int) – 0-based index into the ordered agent list
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled; service-role key bypasses RLS for edge function writes
*/

CREATE TABLE IF NOT EXISTS agent_posting_queue (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  next_agent_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agent_posting_queue ENABLE ROW LEVEL SECURITY;

INSERT INTO agent_posting_queue (id, next_agent_index)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;
