/*
  # Agent Agenda — community-steered AI discussions

  1. New Tables
    - `agent_agenda_topics` — user-proposed topics for AI agents to explore.
      Fields: id, title, description, proposed_by, domain, status
      (proposed / queued / in_progress / completed / archived), upvotes,
      downvotes, score (upvotes - downvotes), target_agents (text[]),
      discussion_id (FK to ai_agent_discussions), scheduled_for, created_at,
      updated_at, moderation_state (visible / hidden / flagged).
    - `agent_agenda_votes` — one up/down vote per user per topic.
    - `agent_agenda_nudges` — short nudges attached to an in-progress discussion.
    - `agent_agenda_nudge_votes` — upvotes on individual nudges.

  2. Security
    - RLS enabled on every table.
    - Any authenticated user can read visible topics/nudges.
    - Anon users can read visible topics/nudges (share links).
    - Authenticated users can insert their own rows.
    - Authors can update/delete their own rows.
    - Votes are unique per (topic_id/nudge_id, user_id).

  3. Triggers
    - Keep `upvotes`, `downvotes`, `score` cached on topics via triggers on votes.
    - Keep `upvotes` cached on nudges via triggers on nudge votes.
    - `updated_at` auto-updated via trigger.
*/

CREATE TABLE IF NOT EXISTS agent_agenda_topics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  proposed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  domain text DEFAULT 'general',
  status text NOT NULL DEFAULT 'proposed',
  target_agents text[] NOT NULL DEFAULT '{}',
  upvotes integer NOT NULL DEFAULT 0,
  downvotes integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  discussion_id uuid REFERENCES ai_agent_discussions(id) ON DELETE SET NULL,
  scheduled_for timestamptz,
  moderation_state text NOT NULL DEFAULT 'visible',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT agent_agenda_topics_status_check
    CHECK (status IN ('proposed','queued','in_progress','completed','archived')),
  CONSTRAINT agent_agenda_topics_moderation_check
    CHECK (moderation_state IN ('visible','hidden','flagged'))
);

CREATE INDEX IF NOT EXISTS idx_agent_agenda_topics_status
  ON agent_agenda_topics(status);
CREATE INDEX IF NOT EXISTS idx_agent_agenda_topics_score
  ON agent_agenda_topics(score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_agenda_topics_proposed_by
  ON agent_agenda_topics(proposed_by);
CREATE INDEX IF NOT EXISTS idx_agent_agenda_topics_discussion_id
  ON agent_agenda_topics(discussion_id);

CREATE TABLE IF NOT EXISTS agent_agenda_votes (
  topic_id uuid NOT NULL REFERENCES agent_agenda_topics(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (topic_id, user_id),
  CONSTRAINT agent_agenda_votes_type_check CHECK (vote_type IN ('up','down'))
);

CREATE INDEX IF NOT EXISTS idx_agent_agenda_votes_user
  ON agent_agenda_votes(user_id);

CREATE TABLE IF NOT EXISTS agent_agenda_nudges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id uuid REFERENCES agent_agenda_topics(id) ON DELETE CASCADE,
  discussion_id uuid REFERENCES ai_agent_discussions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nudge_text text NOT NULL,
  target_agent text,
  upvotes integer NOT NULL DEFAULT 0,
  applied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_agenda_nudges_topic
  ON agent_agenda_nudges(topic_id);
CREATE INDEX IF NOT EXISTS idx_agent_agenda_nudges_discussion
  ON agent_agenda_nudges(discussion_id);
CREATE INDEX IF NOT EXISTS idx_agent_agenda_nudges_user
  ON agent_agenda_nudges(user_id);

CREATE TABLE IF NOT EXISTS agent_agenda_nudge_votes (
  nudge_id uuid NOT NULL REFERENCES agent_agenda_nudges(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (nudge_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_agent_agenda_nudge_votes_user
  ON agent_agenda_nudge_votes(user_id);

ALTER TABLE agent_agenda_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_agenda_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_agenda_nudges ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_agenda_nudge_votes ENABLE ROW LEVEL SECURITY;

-- agent_agenda_topics policies
CREATE POLICY "Anyone can read visible topics"
  ON agent_agenda_topics FOR SELECT
  TO anon, authenticated
  USING (moderation_state = 'visible');

CREATE POLICY "Authors can read their own topics"
  ON agent_agenda_topics FOR SELECT
  TO authenticated
  USING (auth.uid() = proposed_by);

CREATE POLICY "Authenticated users can propose topics"
  ON agent_agenda_topics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = proposed_by);

CREATE POLICY "Authors can update their own topics"
  ON agent_agenda_topics FOR UPDATE
  TO authenticated
  USING (auth.uid() = proposed_by)
  WITH CHECK (auth.uid() = proposed_by);

CREATE POLICY "Authors can delete their own topics"
  ON agent_agenda_topics FOR DELETE
  TO authenticated
  USING (auth.uid() = proposed_by);

-- agent_agenda_votes policies
CREATE POLICY "Anyone can read topic votes"
  ON agent_agenda_votes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can cast their own vote"
  ON agent_agenda_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their own vote"
  ON agent_agenda_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can retract their own vote"
  ON agent_agenda_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- agent_agenda_nudges policies
CREATE POLICY "Anyone can read nudges"
  ON agent_agenda_nudges FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Authenticated users can submit nudges"
  ON agent_agenda_nudges FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can update their nudges"
  ON agent_agenda_nudges FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Authors can delete their nudges"
  ON agent_agenda_nudges FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- agent_agenda_nudge_votes policies
CREATE POLICY "Anyone can read nudge votes"
  ON agent_agenda_nudge_votes FOR SELECT
  TO anon, authenticated
  USING (true);

CREATE POLICY "Users can upvote nudges"
  ON agent_agenda_nudge_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can retract their nudge upvote"
  ON agent_agenda_nudge_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Triggers to keep cached counts in sync
CREATE OR REPLACE FUNCTION recompute_agenda_topic_counts(p_topic_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_up integer;
  v_down integer;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE vote_type = 'up'),
    COUNT(*) FILTER (WHERE vote_type = 'down')
  INTO v_up, v_down
  FROM agent_agenda_votes
  WHERE topic_id = p_topic_id;

  UPDATE agent_agenda_topics
  SET upvotes = COALESCE(v_up, 0),
      downvotes = COALESCE(v_down, 0),
      score = COALESCE(v_up, 0) - COALESCE(v_down, 0),
      updated_at = now()
  WHERE id = p_topic_id;
END;
$$;

CREATE OR REPLACE FUNCTION trg_agenda_votes_recount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM recompute_agenda_topic_counts(OLD.topic_id);
    RETURN OLD;
  ELSE
    PERFORM recompute_agenda_topic_counts(NEW.topic_id);
    IF TG_OP = 'UPDATE' AND OLD.topic_id <> NEW.topic_id THEN
      PERFORM recompute_agenda_topic_counts(OLD.topic_id);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS agent_agenda_votes_recount ON agent_agenda_votes;
CREATE TRIGGER agent_agenda_votes_recount
  AFTER INSERT OR UPDATE OR DELETE ON agent_agenda_votes
  FOR EACH ROW EXECUTE FUNCTION trg_agenda_votes_recount();

CREATE OR REPLACE FUNCTION trg_agenda_nudge_votes_recount()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nudge_id uuid;
  v_count integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_nudge_id := OLD.nudge_id;
  ELSE
    v_nudge_id := NEW.nudge_id;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM agent_agenda_nudge_votes
  WHERE nudge_id = v_nudge_id;

  UPDATE agent_agenda_nudges
  SET upvotes = COALESCE(v_count, 0)
  WHERE id = v_nudge_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS agent_agenda_nudge_votes_recount ON agent_agenda_nudge_votes;
CREATE TRIGGER agent_agenda_nudge_votes_recount
  AFTER INSERT OR DELETE ON agent_agenda_nudge_votes
  FOR EACH ROW EXECUTE FUNCTION trg_agenda_nudge_votes_recount();

CREATE OR REPLACE FUNCTION trg_agent_agenda_topics_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS agent_agenda_topics_set_updated_at ON agent_agenda_topics;
CREATE TRIGGER agent_agenda_topics_set_updated_at
  BEFORE UPDATE ON agent_agenda_topics
  FOR EACH ROW EXECUTE FUNCTION trg_agent_agenda_topics_set_updated_at();
