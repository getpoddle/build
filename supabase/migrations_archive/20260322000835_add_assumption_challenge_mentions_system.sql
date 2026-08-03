/*
  # Add Mention and Comment Notification System

  1. New Tables
    - `assumption_mentions`
      - Links mentions in assumptions to users
      - Tracks which users were mentioned in each assumption
    - `assumption_comment_mentions`
      - Links mentions in assumption comments to users
    - `challenge_mentions`
      - Links mentions in challenges to users
    - `challenge_response_mentions`
      - Links mentions in challenge responses to users
    - `forecast_comments`, `risk_comments`, `scenario_comments`
      - Comment tables for forecasts, risks, and scenarios
      - Allows users to discuss these strategic elements

  2. Changes
    - Add notification triggers for mentions
    - Add notification triggers for comments on assumptions, forecasts, risks, scenarios
    - Add RLS policies for all new tables

  3. Security
    - Enable RLS on all tables
    - Users can view mentions they're part of
    - Users can comment on content they have access to
    - Content creators receive notifications for comments
*/

-- Assumption mentions table
CREATE TABLE IF NOT EXISTS assumption_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assumption_id uuid REFERENCES pod_assumptions(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentioned_by_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(assumption_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_assumption_mentions_mentioned_user ON assumption_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_mentions_assumption ON assumption_mentions(assumption_id);

ALTER TABLE assumption_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view mentions they're in"
  ON assumption_mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid() OR mentioned_by_user_id = auth.uid());

CREATE POLICY "Users can create mentions in accessible assumptions"
  ON assumption_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    mentioned_by_user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM pod_assumptions pa
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE pa.id = assumption_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can delete their own mentions"
  ON assumption_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = auth.uid());

-- Assumption comment mentions table (for existing comments table)
CREATE TABLE IF NOT EXISTS assumption_comment_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id uuid REFERENCES comments(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentioned_by_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(comment_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_assumption_comment_mentions_mentioned_user ON assumption_comment_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_assumption_comment_mentions_comment ON assumption_comment_mentions(comment_id);

ALTER TABLE assumption_comment_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comment mentions"
  ON assumption_comment_mentions FOR SELECT
  TO authenticated
  USING (mentioned_user_id = auth.uid() OR mentioned_by_user_id = auth.uid());

CREATE POLICY "Users can create comment mentions"
  ON assumption_comment_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own comment mentions"
  ON assumption_comment_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = auth.uid());

-- Challenge mentions table
CREATE TABLE IF NOT EXISTS challenge_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id uuid REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentioned_by_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(challenge_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_mentions_mentioned_user ON challenge_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_mentions_challenge ON challenge_mentions(challenge_id);

ALTER TABLE challenge_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view challenge mentions"
  ON challenge_mentions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create challenge mentions"
  ON challenge_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own challenge mentions"
  ON challenge_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = auth.uid());

-- Challenge response mentions table
CREATE TABLE IF NOT EXISTS challenge_response_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid REFERENCES challenge_responses(id) ON DELETE CASCADE NOT NULL,
  mentioned_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  mentioned_by_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(response_id, mentioned_user_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_response_mentions_mentioned_user ON challenge_response_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_response_mentions_response ON challenge_response_mentions(response_id);

ALTER TABLE challenge_response_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view response mentions"
  ON challenge_response_mentions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create response mentions"
  ON challenge_response_mentions FOR INSERT
  TO authenticated
  WITH CHECK (mentioned_by_user_id = auth.uid());

CREATE POLICY "Users can delete their own response mentions"
  ON challenge_response_mentions FOR DELETE
  TO authenticated
  USING (mentioned_by_user_id = auth.uid());

-- Forecast comments table
CREATE TABLE IF NOT EXISTS forecast_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  forecast_id uuid REFERENCES assumption_forecasts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecast_comments_forecast ON forecast_comments(forecast_id);
CREATE INDEX IF NOT EXISTS idx_forecast_comments_user ON forecast_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_forecast_comments_created ON forecast_comments(created_at DESC);

ALTER TABLE forecast_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible forecasts"
  ON forecast_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assumption_forecasts af
      JOIN pod_assumptions pa ON pa.id = af.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE af.id = forecast_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can create comments on accessible forecasts"
  ON forecast_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM assumption_forecasts af
      JOIN pod_assumptions pa ON pa.id = af.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE af.id = forecast_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can update their own forecast comments"
  ON forecast_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own forecast comments"
  ON forecast_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Risk comments table
CREATE TABLE IF NOT EXISTS risk_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  risk_id uuid REFERENCES assumption_risks(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_risk_comments_risk ON risk_comments(risk_id);
CREATE INDEX IF NOT EXISTS idx_risk_comments_user ON risk_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_risk_comments_created ON risk_comments(created_at DESC);

ALTER TABLE risk_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible risks"
  ON risk_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assumption_risks ar
      JOIN pod_assumptions pa ON pa.id = ar.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE ar.id = risk_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can create comments on accessible risks"
  ON risk_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM assumption_risks ar
      JOIN pod_assumptions pa ON pa.id = ar.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE ar.id = risk_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can update their own risk comments"
  ON risk_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own risk comments"
  ON risk_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Scenario comments table
CREATE TABLE IF NOT EXISTS scenario_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id uuid REFERENCES assumption_scenarios(id) ON DELETE CASCADE NOT NULL,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scenario_comments_scenario ON scenario_comments(scenario_id);
CREATE INDEX IF NOT EXISTS idx_scenario_comments_user ON scenario_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_scenario_comments_created ON scenario_comments(created_at DESC);

ALTER TABLE scenario_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view comments on accessible scenarios"
  ON scenario_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assumption_scenarios ass
      JOIN pod_assumptions pa ON pa.id = ass.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE ass.id = scenario_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can create comments on accessible scenarios"
  ON scenario_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM assumption_scenarios ass
      JOIN pod_assumptions pa ON pa.id = ass.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = auth.uid()
      WHERE ass.id = scenario_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

CREATE POLICY "Users can update their own scenario comments"
  ON scenario_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own scenario comments"
  ON scenario_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Notification triggers for assumption mentions
CREATE OR REPLACE FUNCTION notify_assumption_mention()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, link, created_at)
  SELECT 
    NEW.mentioned_user_id,
    'mention',
    (SELECT full_name FROM profiles WHERE id = NEW.mentioned_by_user_id) || 
    ' mentioned you in an assumption',
    '/assumptions/' || NEW.assumption_id,
    now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_assumption_mention ON assumption_mentions;
CREATE TRIGGER trigger_assumption_mention
  AFTER INSERT ON assumption_mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_assumption_mention();

-- Notification triggers for challenge mentions
CREATE OR REPLACE FUNCTION notify_challenge_mention()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, type, content, link, created_at)
  SELECT 
    NEW.mentioned_user_id,
    'mention',
    (SELECT full_name FROM profiles WHERE id = NEW.mentioned_by_user_id) || 
    ' mentioned you in a challenge',
    '/games',
    now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_challenge_mention ON challenge_mentions;
CREATE TRIGGER trigger_challenge_mention
  AFTER INSERT ON challenge_mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_challenge_mention();

-- Notification triggers for forecast comments
CREATE OR REPLACE FUNCTION notify_forecast_comment()
RETURNS TRIGGER AS $$
DECLARE
  forecast_creator_id uuid;
BEGIN
  SELECT af.user_id INTO forecast_creator_id
  FROM assumption_forecasts af
  WHERE af.id = NEW.forecast_id;
  
  IF forecast_creator_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, content, link, created_at)
    VALUES (
      forecast_creator_id,
      'comment',
      (SELECT full_name FROM profiles WHERE id = NEW.user_id) || 
      ' commented on your forecast',
      '/forecasts/' || NEW.forecast_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_forecast_comment ON forecast_comments;
CREATE TRIGGER trigger_forecast_comment
  AFTER INSERT ON forecast_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_forecast_comment();

-- Notification triggers for risk comments
CREATE OR REPLACE FUNCTION notify_risk_comment()
RETURNS TRIGGER AS $$
DECLARE
  risk_creator_id uuid;
BEGIN
  SELECT ar.user_id INTO risk_creator_id
  FROM assumption_risks ar
  WHERE ar.id = NEW.risk_id;
  
  IF risk_creator_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, content, link, created_at)
    VALUES (
      risk_creator_id,
      'comment',
      (SELECT full_name FROM profiles WHERE id = NEW.user_id) || 
      ' commented on your risk assessment',
      '/risks/' || NEW.risk_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_risk_comment ON risk_comments;
CREATE TRIGGER trigger_risk_comment
  AFTER INSERT ON risk_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_risk_comment();

-- Notification triggers for scenario comments
CREATE OR REPLACE FUNCTION notify_scenario_comment()
RETURNS TRIGGER AS $$
DECLARE
  scenario_creator_id uuid;
BEGIN
  SELECT ass.user_id INTO scenario_creator_id
  FROM assumption_scenarios ass
  WHERE ass.id = NEW.scenario_id;
  
  IF scenario_creator_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, content, link, created_at)
    VALUES (
      scenario_creator_id,
      'comment',
      (SELECT full_name FROM profiles WHERE id = NEW.user_id) || 
      ' commented on your scenario',
      '/scenarios/' || NEW.scenario_id,
      now()
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_scenario_comment ON scenario_comments;
CREATE TRIGGER trigger_scenario_comment
  AFTER INSERT ON scenario_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_scenario_comment();

-- Notification for comments on assumptions (using existing comments table)
CREATE OR REPLACE FUNCTION notify_assumption_comment()
RETURNS TRIGGER AS $$
DECLARE
  assumption_creator_id uuid;
  assumption_exists boolean;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pod_assumptions WHERE id = NEW.post_id
  ) INTO assumption_exists;
  
  IF assumption_exists THEN
    SELECT pa.user_id INTO assumption_creator_id
    FROM pod_assumptions pa
    WHERE pa.id = NEW.post_id;
    
    IF assumption_creator_id != NEW.user_id THEN
      INSERT INTO notifications (user_id, type, content, link, created_at)
      VALUES (
        assumption_creator_id,
        'comment',
        (SELECT full_name FROM profiles WHERE id = NEW.user_id) || 
        ' commented on your assumption',
        '/assumptions/' || NEW.post_id,
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_assumption_comment ON comments;
CREATE TRIGGER trigger_assumption_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_assumption_comment();
