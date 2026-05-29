/*
  # Fix Notification Functions - Use Content Column
  
  ## Overview
  Updates all notification functions to use 'content' instead of 'message' column.
  
  ## Changes
  - Fix handle_new_assumption: use 'content' instead of 'message'
  - Fix handle_new_assumption_challenge: use 'content' instead of 'message'
  - Fix handle_new_forecast: use 'content' instead of 'message'
  - Fix handle_new_risk: use 'content' instead of 'message'
  - Fix handle_new_scenario: use 'content' instead of 'message'
*/

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
    INSERT INTO notifications (user_id, type, title, content, related_id)
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
  IF v_assumption_creator IS NOT NULL AND v_assumption_creator != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, content, related_id)
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
  IF v_assumption_creator IS NOT NULL AND v_assumption_creator != NEW.user_id THEN
    INSERT INTO notifications (user_id, type, title, content, related_id)
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
    INSERT INTO notifications (user_id, type, title, content, related_id)
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
    INSERT INTO notifications (user_id, type, title, content, related_id)
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
