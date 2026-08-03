/*
  # Fix Notification Functions - Use Valid Types
  
  ## Overview
  Updates all notification functions to use valid notification types.
  The 'type' field only allows: message, reaction, comment, pod_invite, follow, mention, referral
  
  ## Changes
  - All strategic content notifications will use type 'mention' instead of specific types
  - The related_type field will distinguish the actual content type
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
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
    VALUES (
      v_member_id,
      'mention',
      'New Assumption',
      'New assumption added in ' || COALESCE(v_pod_name, 'pod'),
      NEW.id,
      'assumption',
      NEW.created_by
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
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
    VALUES (
      v_assumption_creator,
      'mention',
      'Assumption Challenged',
      'Someone challenged your assumption',
      NEW.assumption_id,
      'challenge',
      NEW.user_id
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
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
    VALUES (
      v_assumption_creator,
      'mention',
      'New Forecast',
      'Someone added a forecast to your assumption',
      NEW.assumption_id,
      'forecast',
      NEW.user_id
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
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
    VALUES (
      v_assumption_creator,
      'mention',
      'New Risk',
      'Someone added a risk to your assumption',
      NEW.assumption_id,
      'risk',
      NEW.created_by
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
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
    VALUES (
      v_assumption_creator,
      'mention',
      'New Scenario',
      'Someone added a scenario to your assumption',
      NEW.assumption_id,
      'scenario',
      NEW.created_by
    );
  END IF;
  
  RETURN NEW;
END;
$$;
