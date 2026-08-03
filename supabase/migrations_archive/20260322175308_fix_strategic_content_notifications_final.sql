/*
  # Fix Strategic Content Notifications - Final
  
  This migration recreates all notification functions and triggers for strategic content.
  
  1. Functions Created:
    - handle_new_assumption: Notifies pod members of new assumptions
    - handle_new_assumption_challenge: Notifies assumption creator of challenges
    - handle_new_forecast: Notifies assumption creator of new forecasts
    - handle_new_risk: Notifies assumption creator of new risks
    - handle_new_scenario: Notifies assumption creator of new scenarios
  
  2. Security:
    - All functions use SECURITY DEFINER with proper search_path
    - Functions check for valid user and pod relationships
*/

-- Drop existing notification functions if they exist
DROP FUNCTION IF EXISTS handle_new_assumption() CASCADE;
DROP FUNCTION IF EXISTS handle_new_assumption_challenge() CASCADE;
DROP FUNCTION IF EXISTS handle_new_forecast() CASCADE;
DROP FUNCTION IF EXISTS handle_new_risk() CASCADE;
DROP FUNCTION IF EXISTS handle_new_scenario() CASCADE;

-- Function to notify pod members of new assumptions
CREATE OR REPLACE FUNCTION handle_new_assumption()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_member_id uuid;
  v_pod_name text;
BEGIN
  -- Get pod name
  SELECT name INTO v_pod_name
  FROM pods
  WHERE id = NEW.pod_id;
  
  -- Notify all pod members except the creator
  FOR v_member_id IN
    SELECT user_id
    FROM pod_members
    WHERE pod_id = NEW.pod_id
      AND user_id != NEW.created_by
      AND user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_member_id,
      'assumption',
      'New Assumption',
      'New assumption added in ' || COALESCE(v_pod_name, 'pod'),
      NEW.id
    );
  END LOOP;
  
  RETURN NEW;
END;
$$;

-- Function to notify assumption creator of new challenges
CREATE OR REPLACE FUNCTION handle_new_assumption_challenge()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_assumption_creator uuid;
BEGIN
  -- Get the assumption creator
  SELECT created_by INTO v_assumption_creator
  FROM pod_assumptions
  WHERE id = NEW.assumption_id;
  
  -- Only notify if the challenge creator is different from assumption creator
  IF v_assumption_creator IS NOT NULL AND v_assumption_creator != NEW.created_by THEN
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_assumption_creator,
      'challenge',
      'Assumption Challenged',
      'Someone challenged your assumption',
      NEW.assumption_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to notify assumption creator of new forecasts
CREATE OR REPLACE FUNCTION handle_new_forecast()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_assumption_creator uuid;
BEGIN
  -- Get the assumption creator
  SELECT created_by INTO v_assumption_creator
  FROM pod_assumptions
  WHERE id = NEW.assumption_id;
  
  -- Only notify if the forecast creator is different from assumption creator
  IF v_assumption_creator IS NOT NULL AND v_assumption_creator != NEW.created_by THEN
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_assumption_creator,
      'forecast',
      'New Forecast',
      'Someone added a forecast to your assumption',
      NEW.assumption_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to notify assumption creator of new risks
CREATE OR REPLACE FUNCTION handle_new_risk()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_assumption_creator uuid;
BEGIN
  -- Get the assumption creator
  SELECT created_by INTO v_assumption_creator
  FROM pod_assumptions
  WHERE id = NEW.assumption_id;
  
  -- Only notify if the risk creator is different from assumption creator
  IF v_assumption_creator IS NOT NULL AND v_assumption_creator != NEW.created_by THEN
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_assumption_creator,
      'risk',
      'New Risk',
      'Someone added a risk to your assumption',
      NEW.assumption_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Function to notify assumption creator of new scenarios
CREATE OR REPLACE FUNCTION handle_new_scenario()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_assumption_creator uuid;
BEGIN
  -- Get the assumption creator
  SELECT created_by INTO v_assumption_creator
  FROM pod_assumptions
  WHERE id = NEW.assumption_id;
  
  -- Only notify if the scenario creator is different from assumption creator
  IF v_assumption_creator IS NOT NULL AND v_assumption_creator != NEW.created_by THEN
    INSERT INTO notifications (user_id, type, title, message, related_id)
    VALUES (
      v_assumption_creator,
      'scenario',
      'New Scenario',
      'Someone added a scenario to your assumption',
      NEW.assumption_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create triggers for assumptions
DROP TRIGGER IF EXISTS trigger_notify_new_assumption ON pod_assumptions;
CREATE TRIGGER trigger_notify_new_assumption
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_assumption();

-- Create triggers for assumption challenges
DROP TRIGGER IF EXISTS trigger_notify_new_assumption_challenge ON assumption_challenges;
CREATE TRIGGER trigger_notify_new_assumption_challenge
  AFTER INSERT ON assumption_challenges
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_assumption_challenge();

-- Create triggers for forecasts
DROP TRIGGER IF EXISTS trigger_notify_new_forecast ON assumption_forecasts;
CREATE TRIGGER trigger_notify_new_forecast
  AFTER INSERT ON assumption_forecasts
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_forecast();

-- Create triggers for risks
DROP TRIGGER IF EXISTS trigger_notify_new_risk ON assumption_risks;
CREATE TRIGGER trigger_notify_new_risk
  AFTER INSERT ON assumption_risks
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_risk();

-- Create triggers for scenarios
DROP TRIGGER IF EXISTS trigger_notify_new_scenario ON assumption_scenarios;
CREATE TRIGGER trigger_notify_new_scenario
  AFTER INSERT ON assumption_scenarios
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_scenario();
