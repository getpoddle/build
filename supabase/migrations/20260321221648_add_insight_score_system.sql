/*
  # Insight Score System

  ## Overview
  This migration creates the foundation for Poddle's reputation system based on Insight Points.
  Users earn points for valuable contributions that demonstrate strategic thinking.

  ## New Tables
  
  ### `insight_events`
  Tracks every action that awards insight points
  - `id` (uuid, primary key)
  - `user_id` (uuid, references profiles) - Who earned the points
  - `event_type` (text) - Type of contribution (assumption_posted, forecast_added, etc.)
  - `points` (integer) - Points awarded for this event
  - `contribution_id` (uuid, nullable) - Reference to the specific contribution
  - `contribution_type` (text, nullable) - Type of contribution (assumption, forecast, etc.)
  - `metadata` (jsonb, nullable) - Additional context about the event
  - `created_at` (timestamptz)

  ### `user_reputation`
  Aggregated reputation scores per user
  - `user_id` (uuid, primary key, references profiles)
  - `insight_score` (integer) - Total insight points earned
  - `total_contributions` (integer) - Count of all scored contributions
  - `last_calculated_at` (timestamptz) - When scores were last recalculated
  - `updated_at` (timestamptz)
  - `created_at` (timestamptz)

  ## Changes to Existing Tables
  
  ### `profiles`
  - Add `insight_score` column for quick access (denormalized for performance)
  - Add index on insight_score for leaderboards

  ## Security
  - Enable RLS on all new tables
  - Users can read all insight events and reputation scores (transparency)
  - Only system triggers can write to these tables (prevent gaming)
  
  ## Triggers
  - Auto-update user_reputation when insight_events are inserted
  - Auto-update profiles.insight_score for quick access
*/

-- Add insight_score to profiles for quick access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'insight_score'
  ) THEN
    ALTER TABLE profiles ADD COLUMN insight_score integer DEFAULT 0 NOT NULL;
  END IF;
END $$;

-- Create index on insight_score for leaderboards
CREATE INDEX IF NOT EXISTS idx_profiles_insight_score ON profiles(insight_score DESC);

-- Create insight_events table
CREATE TABLE IF NOT EXISTS insight_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  points integer NOT NULL,
  contribution_id uuid,
  contribution_type text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_insight_events_user_id ON insight_events(user_id);
CREATE INDEX IF NOT EXISTS idx_insight_events_created_at ON insight_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_insight_events_contribution ON insight_events(contribution_id, contribution_type);

-- Create user_reputation table
CREATE TABLE IF NOT EXISTS user_reputation (
  user_id uuid PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  insight_score integer DEFAULT 0 NOT NULL,
  total_contributions integer DEFAULT 0 NOT NULL,
  last_calculated_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Create index for sorting
CREATE INDEX IF NOT EXISTS idx_user_reputation_insight_score ON user_reputation(insight_score DESC);

-- Enable RLS
ALTER TABLE insight_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_reputation ENABLE ROW LEVEL SECURITY;

-- RLS Policies for insight_events
-- Everyone can read (transparency is key for trust)
CREATE POLICY "Anyone can view insight events"
  ON insight_events FOR SELECT
  TO authenticated
  USING (true);

-- Only service role can insert (prevents gaming)
-- Note: We'll use triggers and functions to insert, not direct client access

-- RLS Policies for user_reputation
-- Everyone can read reputation scores
CREATE POLICY "Anyone can view user reputation"
  ON user_reputation FOR SELECT
  TO authenticated
  USING (true);

-- Function to update user reputation when insight events are added
CREATE OR REPLACE FUNCTION update_user_reputation()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  -- Insert or update user_reputation
  INSERT INTO user_reputation (user_id, insight_score, total_contributions, last_calculated_at, updated_at)
  VALUES (
    NEW.user_id,
    NEW.points,
    1,
    now(),
    now()
  )
  ON CONFLICT (user_id) DO UPDATE SET
    insight_score = user_reputation.insight_score + NEW.points,
    total_contributions = user_reputation.total_contributions + 1,
    last_calculated_at = now(),
    updated_at = now();
  
  -- Also update the denormalized insight_score in profiles
  UPDATE profiles
  SET insight_score = (
    SELECT COALESCE(SUM(points), 0)
    FROM insight_events
    WHERE user_id = NEW.user_id
  )
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Trigger to update reputation on new insight events
DROP TRIGGER IF EXISTS trigger_update_reputation ON insight_events;
CREATE TRIGGER trigger_update_reputation
  AFTER INSERT ON insight_events
  FOR EACH ROW
  EXECUTE FUNCTION update_user_reputation();

-- Function to award insight points (called by other triggers)
CREATE OR REPLACE FUNCTION award_insight_points(
  p_user_id uuid,
  p_event_type text,
  p_points integer,
  p_contribution_id uuid DEFAULT NULL,
  p_contribution_type text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_event_id uuid;
BEGIN
  -- Insert insight event
  INSERT INTO insight_events (user_id, event_type, points, contribution_id, contribution_type, metadata)
  VALUES (p_user_id, p_event_type, p_points, p_contribution_id, p_contribution_type, p_metadata)
  RETURNING id INTO v_event_id;
  
  RETURN v_event_id;
END;
$$;

-- Initialize user_reputation for existing users
INSERT INTO user_reputation (user_id, insight_score, total_contributions, last_calculated_at, updated_at, created_at)
SELECT 
  id,
  0,
  0,
  now(),
  now(),
  now()
FROM profiles
ON CONFLICT (user_id) DO NOTHING;

-- Create trigger functions for automatic point awards

-- Award points when assumption is posted
CREATE OR REPLACE FUNCTION award_points_for_assumption()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.user_id,
    'assumption_posted',
    10,
    NEW.id,
    'assumption',
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_award_assumption_points ON pod_assumptions;
CREATE TRIGGER trigger_award_assumption_points
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_assumption();

-- Award points when forecast is added
CREATE OR REPLACE FUNCTION award_points_for_forecast()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.user_id,
    'forecast_added',
    15,
    NEW.id,
    'forecast',
    jsonb_build_object('likelihood', NEW.likelihood)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_award_forecast_points ON assumption_forecasts;
CREATE TRIGGER trigger_award_forecast_points
  AFTER INSERT ON assumption_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_forecast();

-- Award points when scenario is added
CREATE OR REPLACE FUNCTION award_points_for_scenario()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.user_id,
    'scenario_added',
    10,
    NEW.id,
    'scenario',
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_award_scenario_points ON assumption_scenarios;
CREATE TRIGGER trigger_award_scenario_points
  AFTER INSERT ON assumption_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_scenario();

-- Award points when risk is identified
CREATE OR REPLACE FUNCTION award_points_for_risk()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.user_id,
    'risk_identified',
    10,
    NEW.id,
    'risk',
    jsonb_build_object('title', NEW.title, 'severity', NEW.severity)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_award_risk_points ON assumption_risks;
CREATE TRIGGER trigger_award_risk_points
  AFTER INSERT ON assumption_risks
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_risk();

-- Award points when challenge is posted
CREATE OR REPLACE FUNCTION award_points_for_challenge()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.user_id,
    'challenge_posted',
    15,
    NEW.id,
    'challenge',
    jsonb_build_object('title', NEW.title, 'category', NEW.category)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_award_challenge_points ON challenges;
CREATE TRIGGER trigger_award_challenge_points
  AFTER INSERT ON challenges
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_challenge();

-- Award points when reference URL is added (evidence quality)
CREATE OR REPLACE FUNCTION award_points_for_reference()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_base_points integer := 5;
  v_multiplier numeric := 1.0;
  v_domain text;
  v_final_points integer;
BEGIN
  -- Only award if reference_url was added (not null and different from old)
  IF NEW.reference_url IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.reference_url IS NULL OR OLD.reference_url != NEW.reference_url) THEN
    -- Extract domain for quality multiplier
    v_domain := substring(NEW.reference_url from '://([^/]+)');
    
    -- Quality multipliers based on source reputation
    IF v_domain ~ '.*(nature\.com|science\.org|cell\.com|nejm\.org|thelancet\.com).*' THEN
      v_multiplier := 3.0; -- Peer-reviewed journals
    ELSIF v_domain ~ '.*(ft\.com|wsj\.com|economist\.com|reuters\.com|bloomberg\.com|nytimes\.com).*' THEN
      v_multiplier := 2.0; -- Reputable news sources
    END IF;
    
    v_final_points := (v_base_points * v_multiplier)::integer;
    
    PERFORM award_insight_points(
      NEW.user_id,
      'reference_added',
      v_final_points,
      NEW.id,
      TG_TABLE_NAME::text,
      jsonb_build_object('url', NEW.reference_url, 'multiplier', v_multiplier)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add triggers for reference URLs on multiple tables
DROP TRIGGER IF EXISTS trigger_award_reference_points_assumptions ON pod_assumptions;
CREATE TRIGGER trigger_award_reference_points_assumptions
  AFTER INSERT OR UPDATE OF reference_url ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_reference();

DROP TRIGGER IF EXISTS trigger_award_reference_points_forecasts ON assumption_forecasts;
CREATE TRIGGER trigger_award_reference_points_forecasts
  AFTER INSERT OR UPDATE OF reference_url ON assumption_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_reference();

DROP TRIGGER IF EXISTS trigger_award_reference_points_scenarios ON assumption_scenarios;
CREATE TRIGGER trigger_award_reference_points_scenarios
  AFTER INSERT OR UPDATE OF reference_url ON assumption_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_reference();

DROP TRIGGER IF EXISTS trigger_award_reference_points_risks ON assumption_risks;
CREATE TRIGGER trigger_award_reference_points_risks
  AFTER INSERT OR UPDATE OF reference_url ON assumption_risks
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_reference();
