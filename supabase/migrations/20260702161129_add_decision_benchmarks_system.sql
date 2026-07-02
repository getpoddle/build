-- Opt-in benchmark flag on pattern intelligence
ALTER TABLE user_pattern_intelligence
  ADD COLUMN IF NOT EXISTS benchmark_opt_in boolean NOT NULL DEFAULT false;

-- Anonymized benchmark contributions — no user_id stored, only a hash for deduplication
CREATE TABLE IF NOT EXISTS decision_benchmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_hash text NOT NULL,   -- md5(user_id::text) — dedup only, never exposed
  category text NOT NULL,           -- dominant risk category: market|execution|financial|team|technology
  health_score integer NOT NULL CHECK (health_score BETWEEN 0 AND 100),
  decision_style text,              -- decision style label for style-level benchmarks
  contributed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(contributor_hash, category)
);

CREATE INDEX IF NOT EXISTS idx_decision_benchmarks_category ON decision_benchmarks(category);
CREATE INDEX IF NOT EXISTS idx_decision_benchmarks_contributed_at ON decision_benchmarks(contributed_at);

ALTER TABLE decision_benchmarks ENABLE ROW LEVEL SECURITY;

-- Block all direct client access — only SECURITY DEFINER RPCs may read
CREATE POLICY "no_direct_select_benchmarks"
  ON decision_benchmarks FOR SELECT TO authenticated USING (false);
CREATE POLICY "no_direct_insert_benchmarks"
  ON decision_benchmarks FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "no_direct_update_benchmarks"
  ON decision_benchmarks FOR UPDATE TO authenticated USING (false);
CREATE POLICY "no_direct_delete_benchmarks"
  ON decision_benchmarks FOR DELETE TO authenticated USING (false);

-- ─── RPC: aggregate stats for a category ────────────────────────────────────
-- Returns count, avg_score, p25_score, p75_score for a given category.
-- Uses SECURITY DEFINER to bypass RLS and read all rows (they are anonymised).
-- Only includes contributions from the last 90 days to keep the benchmark fresh.
CREATE OR REPLACE FUNCTION get_decision_benchmark_stats(p_category text)
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'count',      COUNT(*)::int,
    'avg_score',  ROUND(AVG(health_score))::int,
    'p25_score',  PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY health_score)::int,
    'p75_score',  PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY health_score)::int,
    'p90_score',  PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY health_score)::int
  )
  FROM decision_benchmarks
  WHERE category = p_category
    AND contributed_at > now() - interval '90 days';
$$;

GRANT EXECUTE ON FUNCTION get_decision_benchmark_stats(text) TO authenticated;

-- ─── RPC: user's percentile within a category ───────────────────────────────
-- Given a category and a health_score, returns what percentile the score falls in
-- (0-100, higher = better). Returns null when fewer than 5 contributors exist.
CREATE OR REPLACE FUNCTION get_benchmark_percentile(p_category text, p_score integer)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    CASE
      WHEN COUNT(*) < 5 THEN NULL
      ELSE ROUND(
        (COUNT(*) FILTER (WHERE health_score <= p_score)::numeric / COUNT(*)::numeric) * 100
      )::int
    END
  FROM decision_benchmarks
  WHERE category = p_category
    AND contributed_at > now() - interval '90 days';
$$;

GRANT EXECUTE ON FUNCTION get_benchmark_percentile(text, integer) TO authenticated;
