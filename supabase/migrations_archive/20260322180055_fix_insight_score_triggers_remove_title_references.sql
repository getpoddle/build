/*
  # Fix Insight Score Triggers - Remove Title References
  
  ## Overview
  Updates all insight score trigger functions to remove references to the non-existent 'title' column.
  The tables use 'content' or 'description' instead.
  
  ## Changes
  - Fix award_points_for_assumption: use 'content' instead of 'title'
  - Fix award_points_for_scenario: use 'description' instead of 'title'
  - Fix award_points_for_risk: use 'description' instead of 'title'
  - Fix award_points_for_challenge: remove title reference entirely
*/

-- Fix assumption points trigger
CREATE OR REPLACE FUNCTION award_points_for_assumption()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.created_by,
    'assumption_posted',
    10,
    NEW.id,
    'assumption',
    jsonb_build_object('content', NEW.content, 'category', NEW.category)
  );
  RETURN NEW;
END;
$$;

-- Fix scenario points trigger
CREATE OR REPLACE FUNCTION award_points_for_scenario()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.created_by,
    'scenario_added',
    10,
    NEW.id,
    'scenario',
    jsonb_build_object('description', NEW.description)
  );
  RETURN NEW;
END;
$$;

-- Fix risk points trigger
CREATE OR REPLACE FUNCTION award_points_for_risk()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.created_by,
    'risk_identified',
    10,
    NEW.id,
    'risk',
    jsonb_build_object('description', NEW.description, 'severity', NEW.severity)
  );
  RETURN NEW;
END;
$$;

-- Fix challenge points trigger for assumption_challenges
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
    jsonb_build_object('content', NEW.content)
  );
  RETURN NEW;
END;
$$;

-- Create trigger for assumption_challenges if it doesn't exist
DROP TRIGGER IF EXISTS trigger_award_challenge_points ON assumption_challenges;
CREATE TRIGGER trigger_award_challenge_points
  AFTER INSERT ON assumption_challenges
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_challenge();
