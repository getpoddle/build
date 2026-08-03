/*
  # Add Rich Fields to Entity Tables and Backfill from AI Sources

  1. Schema Changes
    - `problems`: add `solution_steps` (jsonb) for steps to solve the problem
    - `predictions`: add `evidence` (jsonb), `implications` (jsonb), 
      `signal_strength` (text), `agent_role` (text), `contrarian` (boolean)

  2. Data Backfill
    - Ideas: populate execution_steps from posts.next_steps
    - Predictions: populate evidence/implications/signal_strength/agent_role/contrarian from agent_predictions
    - Problems: will be populated by entity-agents later

  3. Notes
    - next_steps in posts is stored as text (JSON string), needs casting
    - agent_predictions has evidence/implications as jsonb arrays
*/

-- Add solution_steps to problems
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'problems' AND column_name = 'solution_steps'
  ) THEN
    ALTER TABLE problems ADD COLUMN solution_steps jsonb DEFAULT '[]'::jsonb;
  END IF;
END $$;

-- Add rich fields to predictions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'evidence'
  ) THEN
    ALTER TABLE predictions ADD COLUMN evidence jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'implications'
  ) THEN
    ALTER TABLE predictions ADD COLUMN implications jsonb DEFAULT '[]'::jsonb;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'signal_strength'
  ) THEN
    ALTER TABLE predictions ADD COLUMN signal_strength text DEFAULT 'building';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'agent_role'
  ) THEN
    ALTER TABLE predictions ADD COLUMN agent_role text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'predictions' AND column_name = 'contrarian'
  ) THEN
    ALTER TABLE predictions ADD COLUMN contrarian boolean DEFAULT false;
  END IF;
END $$;

-- Backfill ideas execution_steps from posts.next_steps
UPDATE ideas
SET execution_steps = p.next_steps::jsonb
FROM posts p
WHERE ideas.id = p.id
  AND p.is_agent_post = true
  AND p.next_steps IS NOT NULL
  AND p.next_steps != ''
  AND p.next_steps != '[]';

-- Backfill predictions from agent_predictions
UPDATE predictions
SET
  evidence = COALESCE(ap.evidence, '[]'::jsonb),
  implications = COALESCE(ap.implications, '[]'::jsonb),
  signal_strength = COALESCE(ap.signal_strength, 'building'),
  agent_role = ap.agent_role,
  contrarian = COALESCE(ap.contrarian, false)
FROM agent_predictions ap
WHERE predictions.id = ap.id;