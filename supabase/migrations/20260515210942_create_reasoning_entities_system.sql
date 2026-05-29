/*
  # Create Reasoning Entities System (Problems, Ideas, Predictions)

  This migration creates the core three-layer cognitive graph that replaces
  the old assumptions system.

  1. New Tables
    - `problems` - Signal layer: observations, concerns, opportunities detected in the world
      - `id` (uuid, primary key)
      - `pod_id` (uuid, FK to pods - organizational grouping)
      - `created_by` (uuid, FK to profiles)
      - `content` (text - the problem statement)
      - `domain` (text - industry/topic domain)
      - `status` (text - lifecycle state)
      - `relevance_score` (integer 0-100 - dynamic importance)
      - `signal_strength` (text - weak/building/strong/confirmed)
      - `evidence_count` (integer - supporting evidence pieces)
      - `slug` (text - URL-friendly identifier)
      - `created_at`, `updated_at` (timestamps)

    - `ideas` - Solution layer: proposed solutions, hypotheses, strategies
      - `id` (uuid, primary key)
      - `pod_id` (uuid, FK to pods)
      - `created_by` (uuid, FK to profiles)
      - `content` (text - the idea description)
      - `domain` (text - industry/topic domain)
      - `status` (text - lifecycle state)
      - `feasibility_score` (integer 0-100)
      - `impact_score` (integer 0-100)
      - `execution_steps` (jsonb - array of action steps)
      - `slug` (text - URL-friendly identifier)
      - `created_at`, `updated_at` (timestamps)

    - `predictions` - Validation layer: testable future claims with time horizons
      - `id` (uuid, primary key)
      - `pod_id` (uuid, FK to pods)
      - `created_by` (uuid, FK to profiles)
      - `content` (text - the prediction statement)
      - `domain` (text - industry/topic domain)
      - `status` (text - lifecycle state)
      - `confidence` (integer 0-100 - probability estimate)
      - `horizon_date` (timestamptz - when this should resolve)
      - `horizon_years` (integer - approximate years to resolution)
      - `outcome` (text - correct/partial/wrong/pending)
      - `outcome_evidence` (text - what confirmed/denied it)
      - `resolved_at` (timestamptz)
      - `slug` (text - URL-friendly identifier)
      - `created_at`, `updated_at` (timestamps)

    - `entity_links` - Typed directional edges between any entities
      - `id` (uuid, primary key)
      - `source_type` (text - problem/idea/prediction)
      - `source_id` (uuid)
      - `target_type` (text - problem/idea/prediction)
      - `target_id` (uuid)
      - `link_type` (text - generates/solves/validates/contradicts/supports/evolves/spawns)
      - `strength` (integer 0-100 - relationship strength)
      - `created_by` (uuid, FK to profiles, nullable for agent-created)
      - `created_by_agent` (boolean - whether an AI agent created this link)
      - `created_at` (timestamp)

    - `entity_state_transitions` - Audit log of all state changes
      - `id` (uuid, primary key)
      - `entity_type` (text - problem/idea/prediction)
      - `entity_id` (uuid)
      - `from_status` (text)
      - `to_status` (text)
      - `reason` (text - why the transition happened)
      - `triggered_by` (uuid, FK to profiles, nullable)
      - `triggered_by_agent` (boolean)
      - `created_at` (timestamp)

    - `entity_challenges` - Challenges/counterpoints to any entity
      - `id` (uuid, primary key)
      - `entity_type` (text - problem/idea/prediction)
      - `entity_id` (uuid)
      - `user_id` (uuid, FK to profiles)
      - `content` (text)
      - `created_at` (timestamp)

    - `entity_agent_responses` - AI agent analysis on any entity
      - `id` (uuid, primary key)
      - `entity_type` (text - problem/idea/prediction)
      - `entity_id` (uuid)
      - `agent_role` (text - which agent persona)
      - `response_type` (text - challenge/risk/alternative/support/question)
      - `content` (text)
      - `confidence_score` (integer 0-100)
      - `reference_links` (jsonb)
      - `created_at` (timestamp)

    - `entity_consensus` - Synthesized AI verdict on any entity
      - `id` (uuid, primary key)
      - `entity_type` (text - problem/idea/prediction)
      - `entity_id` (uuid)
      - `verdict` (text - likely_valid/likely_invalid/mixed/insufficient_data)
      - `confidence_score` (integer 0-100)
      - `summary` (text)
      - `key_points` (jsonb)
      - `positions` (jsonb - individual agent positions)
      - `agent_count` (integer)
      - `created_at`, `updated_at` (timestamps)

  2. Security
    - Enable RLS on all tables
    - Authenticated users can read all entities in pods they belong to
    - Users can create entities in pods they belong to
    - Users can only update/delete their own entities
    - State transitions are append-only (insert only)

  3. Important Notes
    - Problems, Ideas, and Predictions are independent first-class entities
    - entity_links creates the relationship graph between them
    - Status lifecycle: active -> challenged -> evolved -> validated -> invalidated -> deprecated
    - The graph is directional: Problem GENERATES Idea, Idea HAS Prediction, Prediction VALIDATES Idea
*/

-- Problems table (signal layer)
CREATE TABLE IF NOT EXISTS problems (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  domain text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'challenged', 'evolved', 'validated', 'invalidated', 'deprecated')),
  relevance_score integer NOT NULL DEFAULT 50 CHECK (relevance_score >= 0 AND relevance_score <= 100),
  signal_strength text NOT NULL DEFAULT 'building' CHECK (signal_strength IN ('weak', 'building', 'strong', 'confirmed')),
  evidence_count integer NOT NULL DEFAULT 0,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Ideas table (solution layer)
CREATE TABLE IF NOT EXISTS ideas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  domain text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'challenged', 'evolved', 'validated', 'invalidated', 'deprecated')),
  feasibility_score integer NOT NULL DEFAULT 50 CHECK (feasibility_score >= 0 AND feasibility_score <= 100),
  impact_score integer NOT NULL DEFAULT 50 CHECK (impact_score >= 0 AND impact_score <= 100),
  execution_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Predictions table (validation layer)
CREATE TABLE IF NOT EXISTS predictions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pod_id uuid REFERENCES pods(id) ON DELETE CASCADE,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  content text NOT NULL,
  domain text DEFAULT '',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'challenged', 'evolved', 'validated', 'invalidated', 'deprecated')),
  confidence integer NOT NULL DEFAULT 50 CHECK (confidence >= 0 AND confidence <= 100),
  horizon_date timestamptz,
  horizon_years integer DEFAULT 1,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'correct', 'partial', 'wrong')),
  outcome_evidence text DEFAULT '',
  resolved_at timestamptz,
  slug text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Entity links (the relationship graph)
CREATE TABLE IF NOT EXISTS entity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type text NOT NULL CHECK (source_type IN ('problem', 'idea', 'prediction')),
  source_id uuid NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('problem', 'idea', 'prediction')),
  target_id uuid NOT NULL,
  link_type text NOT NULL CHECK (link_type IN ('generates', 'solves', 'validates', 'invalidates', 'contradicts', 'supports', 'evolves', 'spawns', 'depends_on')),
  strength integer NOT NULL DEFAULT 70 CHECK (strength >= 0 AND strength <= 100),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by_agent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(source_type, source_id, target_type, target_id, link_type)
);

-- State transition audit log
CREATE TABLE IF NOT EXISTS entity_state_transitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('problem', 'idea', 'prediction')),
  entity_id uuid NOT NULL,
  from_status text NOT NULL,
  to_status text NOT NULL,
  reason text NOT NULL DEFAULT '',
  triggered_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  triggered_by_agent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Challenges on any entity
CREATE TABLE IF NOT EXISTS entity_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('problem', 'idea', 'prediction')),
  entity_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI agent responses on any entity
CREATE TABLE IF NOT EXISTS entity_agent_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('problem', 'idea', 'prediction')),
  entity_id uuid NOT NULL,
  agent_role text NOT NULL,
  response_type text NOT NULL CHECK (response_type IN ('challenge', 'risk', 'alternative', 'support', 'question', 'analysis')),
  content text NOT NULL,
  confidence_score integer NOT NULL DEFAULT 75 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  reference_links jsonb DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- AI consensus on any entity
CREATE TABLE IF NOT EXISTS entity_consensus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('problem', 'idea', 'prediction')),
  entity_id uuid NOT NULL,
  verdict text NOT NULL CHECK (verdict IN ('likely_valid', 'likely_invalid', 'mixed', 'insufficient_data')),
  confidence_score integer NOT NULL DEFAULT 50 CHECK (confidence_score >= 0 AND confidence_score <= 100),
  summary text NOT NULL DEFAULT '',
  key_points jsonb NOT NULL DEFAULT '[]'::jsonb,
  positions jsonb NOT NULL DEFAULT '[]'::jsonb,
  agent_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE problems ENABLE ROW LEVEL SECURITY;
ALTER TABLE ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_agent_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE entity_consensus ENABLE ROW LEVEL SECURITY;

-- RLS Policies for problems
CREATE POLICY "Authenticated users can read problems"
  ON problems FOR SELECT
  TO authenticated
  USING (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

CREATE POLICY "Pod members can create problems"
  ON problems FOR INSERT
  TO authenticated
  WITH CHECK (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update own problems"
  ON problems FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own problems"
  ON problems FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for ideas
CREATE POLICY "Authenticated users can read ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

CREATE POLICY "Pod members can create ideas"
  ON ideas FOR INSERT
  TO authenticated
  WITH CHECK (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update own ideas"
  ON ideas FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own ideas"
  ON ideas FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for predictions
CREATE POLICY "Authenticated users can read predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    OR pod_id IN (SELECT id FROM pods WHERE is_public = true)
  );

CREATE POLICY "Pod members can create predictions"
  ON predictions FOR INSERT
  TO authenticated
  WITH CHECK (
    pod_id IN (SELECT pod_id FROM pod_members WHERE user_id = auth.uid())
    AND created_by = auth.uid()
  );

CREATE POLICY "Users can update own predictions"
  ON predictions FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can delete own predictions"
  ON predictions FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for entity_links
CREATE POLICY "Authenticated users can read entity links"
  ON entity_links FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create entity links"
  ON entity_links FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid() OR created_by_agent = true);

CREATE POLICY "Link creators can delete their links"
  ON entity_links FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- RLS Policies for entity_state_transitions (append-only)
CREATE POLICY "Authenticated users can read state transitions"
  ON entity_state_transitions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create state transitions"
  ON entity_state_transitions FOR INSERT
  TO authenticated
  WITH CHECK (triggered_by = auth.uid() OR triggered_by_agent = true);

-- RLS Policies for entity_challenges
CREATE POLICY "Authenticated users can read challenges"
  ON entity_challenges FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create challenges"
  ON entity_challenges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own challenges"
  ON entity_challenges FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- RLS Policies for entity_agent_responses
CREATE POLICY "Authenticated users can read agent responses"
  ON entity_agent_responses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role inserts agent responses"
  ON entity_agent_responses FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- RLS Policies for entity_consensus
CREATE POLICY "Authenticated users can read consensus"
  ON entity_consensus FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role inserts consensus"
  ON entity_consensus FOR INSERT
  TO authenticated
  WITH CHECK (false);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_problems_pod_id ON problems(pod_id);
CREATE INDEX IF NOT EXISTS idx_problems_created_by ON problems(created_by);
CREATE INDEX IF NOT EXISTS idx_problems_status ON problems(status);
CREATE INDEX IF NOT EXISTS idx_problems_slug ON problems(slug);

CREATE INDEX IF NOT EXISTS idx_ideas_pod_id ON ideas(pod_id);
CREATE INDEX IF NOT EXISTS idx_ideas_created_by ON ideas(created_by);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
CREATE INDEX IF NOT EXISTS idx_ideas_slug ON ideas(slug);

CREATE INDEX IF NOT EXISTS idx_predictions_pod_id ON predictions(pod_id);
CREATE INDEX IF NOT EXISTS idx_predictions_created_by ON predictions(created_by);
CREATE INDEX IF NOT EXISTS idx_predictions_status ON predictions(status);
CREATE INDEX IF NOT EXISTS idx_predictions_outcome ON predictions(outcome);
CREATE INDEX IF NOT EXISTS idx_predictions_slug ON predictions(slug);

CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_link_type ON entity_links(link_type);

CREATE INDEX IF NOT EXISTS idx_entity_state_transitions_entity ON entity_state_transitions(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_challenges_entity ON entity_challenges(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_agent_responses_entity ON entity_agent_responses(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_entity_consensus_entity ON entity_consensus(entity_type, entity_id);

-- Anonymous read access for public entities
CREATE POLICY "Anyone can read problems in public pods"
  ON problems FOR SELECT
  TO anon
  USING (pod_id IN (SELECT id FROM pods WHERE is_public = true));

CREATE POLICY "Anyone can read ideas in public pods"
  ON ideas FOR SELECT
  TO anon
  USING (pod_id IN (SELECT id FROM pods WHERE is_public = true));

CREATE POLICY "Anyone can read predictions in public pods"
  ON predictions FOR SELECT
  TO anon
  USING (pod_id IN (SELECT id FROM pods WHERE is_public = true));

CREATE POLICY "Anyone can read entity links"
  ON entity_links FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can read consensus"
  ON entity_consensus FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can read agent responses"
  ON entity_agent_responses FOR SELECT
  TO anon
  USING (true);