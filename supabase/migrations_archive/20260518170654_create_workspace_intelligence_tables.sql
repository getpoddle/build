/*
  # Workspace Intelligence System

  Stores auto-synthesized strategic intelligence derived from workspace conversations.

  1. New Tables

    - `workspace_synthesis`
      Stores the latest AI War Room synthesis for a workspace.
      Re-generated on demand (max one per workspace, upserted).
      - `id` (uuid, pk)
      - `workspace_id` (uuid, FK → workspaces, unique)
      - `consensus_points` (jsonb): array of { text, confidence, source_count }
      - `conflict_zones` (jsonb): array of { topic, agent_a, agent_b, tension_level }
      - `open_questions` (jsonb): array of { question, urgency }
      - `risk_signals` (jsonb): array of { signal, severity, category }
      - `decision_health_score` (int): 0-100 composite score
      - `blind_spots` (jsonb): array of { area, description }
      - `generated_at` (timestamptz)
      - `message_count_at_generation` (int): how many messages existed when synthesized

    - `workspace_divergence_events`
      Tracks specific moments where agents took opposing positions.
      - `id` (uuid, pk)
      - `workspace_id` (uuid, FK → workspaces)
      - `user_message` (text): the message that triggered the divergence
      - `topic` (text): short label
      - `positions` (jsonb): array of { agent_name, agent_role, stance, summary }
      - `divergence_score` (int): 0-100, how strongly they disagreed
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled on both tables
    - Workspace members can read
    - Inserts/updates via service role only (Edge Function)
*/

CREATE TABLE IF NOT EXISTS workspace_synthesis (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id                uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  consensus_points            jsonb NOT NULL DEFAULT '[]',
  conflict_zones              jsonb NOT NULL DEFAULT '[]',
  open_questions              jsonb NOT NULL DEFAULT '[]',
  risk_signals                jsonb NOT NULL DEFAULT '[]',
  blind_spots                 jsonb NOT NULL DEFAULT '[]',
  decision_health_score       int NOT NULL DEFAULT 0,
  generated_at                timestamptz NOT NULL DEFAULT now(),
  message_count_at_generation int NOT NULL DEFAULT 0,
  UNIQUE(workspace_id)
);

CREATE TABLE IF NOT EXISTS workspace_divergence_events (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_message     text NOT NULL,
  topic            text NOT NULL,
  positions        jsonb NOT NULL DEFAULT '[]',
  divergence_score int NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ws_synthesis_workspace ON workspace_synthesis(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_divergence_workspace ON workspace_divergence_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_ws_divergence_created ON workspace_divergence_events(workspace_id, created_at DESC);

ALTER TABLE workspace_synthesis ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_divergence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Workspace members can read synthesis"
  ON workspace_synthesis FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

CREATE POLICY "Workspace members can read divergence"
  ON workspace_divergence_events FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));
