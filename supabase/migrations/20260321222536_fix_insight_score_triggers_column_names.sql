/*
  # Fix Insight Score Triggers Column Names

  ## Overview
  Updates the trigger functions to use the correct column names for each table.
  The previous migration used incorrect column names (user_id vs created_by).

  ## Changes
  - Update assumption trigger to use created_by instead of user_id
  - Update forecast trigger to use user_id (correct)
  - Update scenario trigger to use created_by instead of user_id
  - Update risk trigger to use created_by instead of user_id
  - Update challenge trigger to use creator_id instead of user_id
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
    jsonb_build_object('title', NEW.title)
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
    jsonb_build_object('title', NEW.title)
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
    jsonb_build_object('title', NEW.title, 'severity', NEW.severity)
  );
  RETURN NEW;
END;
$$;

-- Fix challenge points trigger
CREATE OR REPLACE FUNCTION award_points_for_challenge()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM award_insight_points(
    NEW.creator_id,
    'challenge_posted',
    15,
    NEW.id,
    'challenge',
    jsonb_build_object('title', NEW.title)
  );
  RETURN NEW;
END;
$$;

-- Fix forecast points trigger (already correct, but updating for consistency)
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
    jsonb_build_object('probability', NEW.probability)
  );
  RETURN NEW;
END;
$$;

-- Fix reference URL trigger function to handle different table column names
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
  v_user_id uuid;
BEGIN
  -- Only award if reference_url was added (not null and different from old)
  IF NEW.reference_url IS NOT NULL AND (TG_OP = 'INSERT' OR OLD.reference_url IS NULL OR OLD.reference_url != NEW.reference_url) THEN
    -- Get the user_id based on the table name
    IF TG_TABLE_NAME = 'assumption_forecasts' THEN
      v_user_id := NEW.user_id;
    ELSIF TG_TABLE_NAME = 'pod_assumptions' THEN
      v_user_id := NEW.created_by;
    ELSIF TG_TABLE_NAME = 'assumption_scenarios' THEN
      v_user_id := NEW.created_by;
    ELSIF TG_TABLE_NAME = 'assumption_risks' THEN
      v_user_id := NEW.created_by;
    ELSE
      RETURN NEW; -- Unknown table, skip
    END IF;
    
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
      v_user_id,
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

-- Recreate all triggers to ensure they're using the updated functions
DROP TRIGGER IF EXISTS trigger_award_assumption_points ON pod_assumptions;
CREATE TRIGGER trigger_award_assumption_points
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_assumption();

DROP TRIGGER IF EXISTS trigger_award_forecast_points ON assumption_forecasts;
CREATE TRIGGER trigger_award_forecast_points
  AFTER INSERT ON assumption_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_forecast();

DROP TRIGGER IF EXISTS trigger_award_scenario_points ON assumption_scenarios;
CREATE TRIGGER trigger_award_scenario_points
  AFTER INSERT ON assumption_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_scenario();

DROP TRIGGER IF EXISTS trigger_award_risk_points ON assumption_risks;
CREATE TRIGGER trigger_award_risk_points
  AFTER INSERT ON assumption_risks
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_risk();

DROP TRIGGER IF EXISTS trigger_award_challenge_points ON challenges;
CREATE TRIGGER trigger_award_challenge_points
  AFTER INSERT ON challenges
  FOR EACH ROW
  EXECUTE FUNCTION award_points_for_challenge();

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
