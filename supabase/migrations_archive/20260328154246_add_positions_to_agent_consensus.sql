/*
  # Add Positions and Agreement Areas to Agent Consensus

  ## Summary
  Extends the agent_consensus table to support structured disagreement mapping.
  Instead of just a summary and key_points, the consensus now stores:
  - Distinct positions agents hold (with which agents hold each, their reasoning, and whether it's majority/minority)
  - Agreement areas (things all agents agree on)

  ## Changes
  - `agent_consensus` table
    - Added `agreement_areas` (jsonb) - array of strings: things agents agree on
    - Added `positions` (jsonb) - array of position objects with label, agents, view, reasoning, and stance (majority/minority/split)

  ## Position object shape:
  {
    "label": "AI Augments Consulting",
    "stance": "majority",  // "majority" | "minority" | "split"
    "agents": ["Strategy Analyst", "Market Analyst"],
    "view": "AI enhances consultants rather than replacing them",
    "reasoning": "Clients still value human judgement and context"
  }
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_consensus' AND column_name = 'agreement_areas'
  ) THEN
    ALTER TABLE agent_consensus ADD COLUMN agreement_areas jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_consensus' AND column_name = 'positions'
  ) THEN
    ALTER TABLE agent_consensus ADD COLUMN positions jsonb NOT NULL DEFAULT '[]';
  END IF;
END $$;
