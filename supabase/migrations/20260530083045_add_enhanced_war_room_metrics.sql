/*
  # Enhanced War Room Metrics

  Adds richer intelligence metric columns to the workspace_synthesis table to support
  financial, operational, and strategic metric outputs from the AI synthesis engine.

  ## New Columns on workspace_synthesis
  - `financial_metrics` (jsonb) — budget signals, cost/revenue projections, financial risk exposure
  - `operational_metrics` (jsonb) — timeline clarity, resource constraints, bottlenecks, readiness
  - `non_financial_metrics` (jsonb) — team morale, stakeholder buy-in, strategic alignment signals
  - `opportunity_signals` (jsonb) — upsides and strategic opportunities identified or implied
  - `cognitive_bias_flags` (jsonb) — detected reasoning traps with counter-questions
  - `financial_score` (int) — 0-100 Financial Clarity sub-score
  - `operational_score` (int) — 0-100 Operational Readiness sub-score
  - `alignment_score` (int) — 0-100 Strategic Alignment sub-score
  - `decision_velocity` (text) — Fast / Moderate / Stalling
  - `confidence_trajectory` (text) — rising / flat / falling

  ## New Columns on workspace_synthesis_history
  - `financial_score` (int) — for trend tracking
  - `operational_score` (int) — for trend tracking
  - `alignment_score` (int) — for trend tracking

  All columns are nullable for backwards compatibility with existing synthesis rows.
*/

-- workspace_synthesis: new metric columns
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'financial_metrics') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN financial_metrics jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'operational_metrics') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN operational_metrics jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'non_financial_metrics') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN non_financial_metrics jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'opportunity_signals') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN opportunity_signals jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'cognitive_bias_flags') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN cognitive_bias_flags jsonb;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'financial_score') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN financial_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'operational_score') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN operational_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'alignment_score') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN alignment_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'decision_velocity') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN decision_velocity text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis' AND column_name = 'confidence_trajectory') THEN
    ALTER TABLE workspace_synthesis ADD COLUMN confidence_trajectory text;
  END IF;
END $$;

-- workspace_synthesis_history: sub-score columns for trend tracking
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis_history' AND column_name = 'financial_score') THEN
    ALTER TABLE workspace_synthesis_history ADD COLUMN financial_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis_history' AND column_name = 'operational_score') THEN
    ALTER TABLE workspace_synthesis_history ADD COLUMN operational_score integer;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'workspace_synthesis_history' AND column_name = 'alignment_score') THEN
    ALTER TABLE workspace_synthesis_history ADD COLUMN alignment_score integer;
  END IF;
END $$;
