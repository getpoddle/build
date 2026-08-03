/*
  # Add Post AI Insights and Weekly Digest Tables

  ## Overview
  Two new tables to support:
  1. AI analysis of feed posts — surfacing the hidden assumption or contradiction with pod knowledge
  2. Weekly digest tracking — recording when digests were generated and what they contained

  ## New Tables

  ### post_ai_insights
  Stores AI-generated insights for individual posts.
  - `id` — primary key
  - `post_id` — references the posts table
  - `insight_type` — either "assumption" (hidden assumption detected) or "contradiction" (contradicts pod knowledge)
  - `insight_text` — the AI-generated insight (2-3 sentences)
  - `related_pod_id` — optional: which pod this relates to (for contradictions)
  - `confidence_score` — 0–100
  - `generated_at` — when the insight was created

  ### weekly_digests
  Records generated weekly digests per user.
  - `id` — primary key
  - `user_id` — the user this digest is for
  - `top_assumptions` — JSONB array of top assumption summaries
  - `ai_highlights` — JSONB array of notable AI agent findings
  - `pod_changes` — JSONB array of what changed in pods this week
  - `summary_text` — AI-generated narrative summary (2–4 sentences)
  - `week_start` — start of the week this covers
  - `generated_at` — when generated

  ## Security
  - RLS enabled on both tables
  - post_ai_insights: public SELECT (insights are public data), service-role INSERT
  - weekly_digests: authenticated users can only read their own digest
*/

CREATE TABLE IF NOT EXISTS post_ai_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  insight_type text NOT NULL DEFAULT 'assumption' CHECK (insight_type IN ('assumption', 'contradiction')),
  insight_text text NOT NULL DEFAULT '',
  related_pod_id uuid REFERENCES pods(id) ON DELETE SET NULL,
  confidence_score integer NOT NULL DEFAULT 70 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  generated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_post_ai_insights_post_id ON post_ai_insights(post_id);
CREATE INDEX IF NOT EXISTS idx_post_ai_insights_generated_at ON post_ai_insights(generated_at DESC);

ALTER TABLE post_ai_insights ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view post ai insights"
  ON post_ai_insights FOR SELECT
  TO authenticated
  USING (true);

CREATE TABLE IF NOT EXISTS weekly_digests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  top_assumptions jsonb NOT NULL DEFAULT '[]',
  ai_highlights jsonb NOT NULL DEFAULT '[]',
  pod_changes jsonb NOT NULL DEFAULT '[]',
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
