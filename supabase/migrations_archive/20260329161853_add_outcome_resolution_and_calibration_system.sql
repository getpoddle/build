/*
  # Forecasting Track Record & Calibration Score System

  ## Summary
  This migration creates the infrastructure for outcome resolution and forecaster calibration scoring.
  Users can now mark assumptions as Confirmed, Refuted, or Still Open with evidence. The system
  automatically computes each user's Brier-based calibration score, rewarding accurate probability
  forecasters and surfacing a public leaderboard.

  ## New Tables

  ### 1. assumption_outcomes
  Records the resolved outcome for any assumption.
  - `id` - UUID primary key
  - `assumption_id` - FK to pod_assumptions (unique — one outcome per assumption)
  - `resolved_by` - FK to profiles (who resolved it)
  - `outcome` - enum: 'confirmed' | 'refuted' | 'still_open'
  - `evidence` - text description or URL explaining the resolution
  - `resolved_at` - timestamp of resolution

  ### 2. forecaster_calibration
  Aggregated calibration stats per user, updated by trigger whenever an outcome is resolved.
  - `id` - UUID primary key
  - `user_id` - FK to profiles (unique per user)
  - `total_forecasts_resolved` - how many of their forecasts have been resolved
  - `brier_score_sum` - sum of (probability - outcome)^2 across resolved forecasts (lower = better)
  - `brier_score_avg` - brier_score_sum / total_forecasts_resolved
  - `calibration_score` - 100 * (1 - brier_score_avg), 0-100, higher = better calibrated
  - `confirmed_count` - how many of user's forecasts correctly predicted >50% for confirmed assumptions
  - `refuted_count` - how many of user's forecasts correctly predicted <50% for refuted assumptions
  - `accuracy_rate` - (confirmed_count + refuted_count) / total_forecasts_resolved
  - `last_updated` - timestamp

  ## Security
  - RLS enabled on both tables
  - Anyone authenticated can read outcomes (public knowledge)
  - Only pod members can resolve outcomes (enforced via check)
  - Calibration stats are public read, system-written only
  - Trigger function uses SECURITY DEFINER to update calibration after each outcome

  ## Important Notes
  1. Brier score: for each resolved forecast, (p/100 - outcome_binary)^2 where outcome_binary=1 for confirmed, 0 for refuted
  2. Calibration score = 100 * (1 - avg_brier), so 100 = perfect, 0 = worst
  3. Only forecasts with probability != 50 are included (50% carries no information)
  4. "Still open" resolutions do not affect calibration scores
*/

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. ASSUMPTION OUTCOMES TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS assumption_outcomes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid NOT NULL REFERENCES pod_assumptions(id) ON DELETE CASCADE,
  resolved_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('confirmed', 'refuted', 'still_open')),
  evidence text DEFAULT '',
  resolved_at timestamptz DEFAULT now(),
  UNIQUE(assumption_id)
);

CREATE INDEX IF NOT EXISTS idx_assumption_outcomes_assumption_id ON assumption_outcomes(assumption_id);
CREATE INDEX IF NOT EXISTS idx_assumption_outcomes_resolved_by ON assumption_outcomes(resolved_by);
CREATE INDEX IF NOT EXISTS idx_assumption_outcomes_outcome ON assumption_outcomes(outcome);

ALTER TABLE assumption_outcomes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view outcomes"
  ON assumption_outcomes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can resolve outcomes"
  ON assumption_outcomes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = resolved_by);

CREATE POLICY "Resolver can update their outcome"
  ON assumption_outcomes FOR UPDATE
  TO authenticated
  USING (auth.uid() = resolved_by)
  WITH CHECK (auth.uid() = resolved_by);

CREATE POLICY "Resolver can delete their outcome"
  ON assumption_outcomes FOR DELETE
  TO authenticated
  USING (auth.uid() = resolved_by);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. FORECASTER CALIBRATION TABLE
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS forecaster_calibration (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  total_forecasts_resolved integer DEFAULT 0,
  brier_score_sum numeric(10,6) DEFAULT 0,
  brier_score_avg numeric(10,6) DEFAULT 0,
  calibration_score numeric(6,2) DEFAULT 0,
  confirmed_correct integer DEFAULT 0,
  refuted_correct integer DEFAULT 0,
  accuracy_rate numeric(6,4) DEFAULT 0,
  last_updated timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_forecaster_calibration_user_id ON forecaster_calibration(user_id);
CREATE INDEX IF NOT EXISTS idx_forecaster_calibration_score ON forecaster_calibration(calibration_score DESC);
CREATE INDEX IF NOT EXISTS idx_forecaster_calibration_total ON forecaster_calibration(total_forecasts_resolved DESC);

ALTER TABLE forecaster_calibration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view calibration scores"
  ON forecaster_calibration FOR SELECT
  TO authenticated
  USING (true);

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. TRIGGER FUNCTION: Recompute calibration after outcome resolution
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recompute_calibration_for_forecasters()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_outcome_binary numeric;
  v_assumption_id uuid;
  v_outcome text;
  v_forecaster record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_assumption_id := OLD.assumption_id;
    v_outcome := OLD.outcome;
  ELSE
    v_assumption_id := NEW.assumption_id;
    v_outcome := NEW.outcome;
  END IF;

  -- Only confirmed/refuted affect calibration (still_open is neutral)
  IF v_outcome = 'still_open' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF v_outcome = 'confirmed' THEN
    v_outcome_binary := 1.0;
  ELSE
    v_outcome_binary := 0.0;
  END IF;

  -- Recompute calibration for every forecaster on this assumption (excluding 50% = no-information)
  FOR v_forecaster IN
    SELECT DISTINCT user_id
    FROM assumption_forecasts
    WHERE assumption_id = v_assumption_id
      AND probability != 50
  LOOP
    -- Upsert a calibration row for this user
    INSERT INTO forecaster_calibration(user_id) VALUES (v_forecaster.user_id)
    ON CONFLICT (user_id) DO NOTHING;

    -- Recompute all stats from scratch for this user across all resolved assumptions
    UPDATE forecaster_calibration fc
    SET
      total_forecasts_resolved = stats.n,
      brier_score_sum = stats.brier_sum,
      brier_score_avg = CASE WHEN stats.n > 0 THEN stats.brier_sum / stats.n ELSE 0 END,
      calibration_score = CASE WHEN stats.n > 0 THEN GREATEST(0, LEAST(100, 100.0 * (1.0 - (stats.brier_sum / stats.n)))) ELSE 0 END,
      confirmed_correct = stats.conf_correct,
      refuted_correct = stats.ref_correct,
      accuracy_rate = CASE WHEN stats.n > 0 THEN (stats.conf_correct + stats.ref_correct)::numeric / stats.n ELSE 0 END,
      last_updated = now()
    FROM (
      SELECT
        COUNT(*)::integer AS n,
        SUM(POWER((af.probability::numeric / 100.0) - ao_binary.outcome_b, 2)) AS brier_sum,
        SUM(CASE WHEN ao_binary.outcome_b = 1 AND af.probability > 50 THEN 1 ELSE 0 END)::integer AS conf_correct,
        SUM(CASE WHEN ao_binary.outcome_b = 0 AND af.probability < 50 THEN 1 ELSE 0 END)::integer AS ref_correct
      FROM assumption_forecasts af
      JOIN assumption_outcomes ao ON ao.assumption_id = af.assumption_id
      JOIN LATERAL (SELECT CASE WHEN ao.outcome = 'confirmed' THEN 1.0 ELSE 0.0 END AS outcome_b) ao_binary ON true
      WHERE af.user_id = v_forecaster.user_id
        AND af.probability != 50
        AND ao.outcome IN ('confirmed', 'refuted')
    ) stats
    WHERE fc.user_id = v_forecaster.user_id;

  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_recompute_calibration ON assumption_outcomes;

CREATE TRIGGER trg_recompute_calibration
  AFTER INSERT OR UPDATE OR DELETE ON assumption_outcomes
  FOR EACH ROW
  EXECUTE FUNCTION recompute_calibration_for_forecasters();
