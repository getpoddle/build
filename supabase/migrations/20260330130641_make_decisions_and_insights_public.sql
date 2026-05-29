/*
  # Make All Decisions and Insights Public

  ## Summary
  Opens read access on pods (decision rooms) and insights to both
  unauthenticated (anon) and authenticated users.

  ## Changes
  1. Ensures all existing pods have is_private = false, is_public = true
  2. Replaces pods SELECT policy to allow anon + authenticated reads
  3. Replaces pod_assumptions SELECT policy to allow anon + authenticated reads
  4. Adds anon read access to all insight/agent-related tables

  ## Security
  All write operations (INSERT/UPDATE/DELETE) remain authenticated-only.
*/

-- Ensure all rooms are public
UPDATE pods SET is_private = false, is_public = true
WHERE is_private IS DISTINCT FROM false OR is_public IS DISTINCT FROM true;

-- ── pods ──────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Public pods visible to all authenticated users" ON pods;

CREATE POLICY "Public pods readable by everyone"
  ON pods FOR SELECT
  TO authenticated, anon
  USING (is_private = false OR owner_id = auth.uid());

-- ── pod_assumptions ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated users can read assumptions" ON pod_assumptions;

CREATE POLICY "Assumptions readable by everyone"
  ON pod_assumptions FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── agent_consensus ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read agent consensus" ON agent_consensus;
CREATE POLICY "Anyone can read agent consensus"
  ON agent_consensus FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── agent_responses ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read agent responses" ON agent_responses;
CREATE POLICY "Anyone can read agent responses"
  ON agent_responses FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── assumption_forecasts ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read assumption forecasts" ON assumption_forecasts;
CREATE POLICY "Anyone can read assumption forecasts"
  ON assumption_forecasts FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── assumption_outcomes ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read assumption outcomes" ON assumption_outcomes;
CREATE POLICY "Anyone can read assumption outcomes"
  ON assumption_outcomes FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── assumption_risks ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read assumption risks" ON assumption_risks;
CREATE POLICY "Anyone can read assumption risks"
  ON assumption_risks FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── assumption_scenarios ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read assumption scenarios" ON assumption_scenarios;
CREATE POLICY "Anyone can read assumption scenarios"
  ON assumption_scenarios FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── insights ──────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read insights" ON insights;
CREATE POLICY "Anyone can read insights"
  ON insights FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── insight_events ────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read insight events" ON insight_events;
CREATE POLICY "Anyone can read insight events"
  ON insight_events FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── insight_likes ─────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read insight likes" ON insight_likes;
CREATE POLICY "Anyone can read insight likes"
  ON insight_likes FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── post_ai_insights ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read post ai insights" ON post_ai_insights;
CREATE POLICY "Anyone can read post ai insights"
  ON post_ai_insights FOR SELECT
  TO authenticated, anon
  USING (true);

-- ── assumption_challenges ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Anyone can read assumption challenges" ON assumption_challenges;
CREATE POLICY "Anyone can read assumption challenges"
  ON assumption_challenges FOR SELECT
  TO authenticated, anon
  USING (true);
