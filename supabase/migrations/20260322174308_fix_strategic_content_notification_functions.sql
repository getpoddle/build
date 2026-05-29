/*
  # Fix Strategic Content Notification Functions

  1. Changes
    - Fix column references in notification functions
    - pod_assumptions uses `created_by` not `user_id`
    - assumption_risks uses `created_by` not `user_id`
    - assumption_scenarios uses `created_by` not `user_id`
    - assumption_forecasts uses `user_id` (correct)

  2. Functions Fixed
    - notify_risk_comment
    - notify_scenario_comment
    - notify_assumption_comment
*/

-- Fix notify_risk_comment function
CREATE OR REPLACE FUNCTION notify_risk_comment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  risk_creator_id uuid;
  commenter_name text;
BEGIN
  SELECT ar.created_by INTO risk_creator_id
  FROM assumption_risks ar
  WHERE ar.id = NEW.risk_id;
  
  IF risk_creator_id != NEW.user_id THEN
    SELECT full_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.user_id;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      related_id,
      related_type,
      actor_id
    )
    VALUES (
      risk_creator_id,
      'comment',
      'New comment',
      commenter_name || ' commented on your risk assessment',
      NEW.risk_id,
      'risk',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix notify_scenario_comment function
CREATE OR REPLACE FUNCTION notify_scenario_comment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  scenario_creator_id uuid;
  commenter_name text;
BEGIN
  SELECT ass.created_by INTO scenario_creator_id
  FROM assumption_scenarios ass
  WHERE ass.id = NEW.scenario_id;
  
  IF scenario_creator_id != NEW.user_id THEN
    SELECT full_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.user_id;

    INSERT INTO notifications (
      user_id,
      type,
      title,
      content,
      related_id,
      related_type,
      actor_id
    )
    VALUES (
      scenario_creator_id,
      'comment',
      'New comment',
      commenter_name || ' commented on your scenario',
      NEW.scenario_id,
      'scenario',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Fix notify_assumption_comment function
CREATE OR REPLACE FUNCTION notify_assumption_comment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  assumption_creator_id uuid;
  assumption_exists boolean;
  commenter_name text;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM pod_assumptions WHERE id = NEW.post_id
  ) INTO assumption_exists;
  
  IF assumption_exists THEN
    SELECT pa.created_by INTO assumption_creator_id
    FROM pod_assumptions pa
    WHERE pa.id = NEW.post_id;
    
    IF assumption_creator_id != NEW.user_id THEN
      SELECT full_name INTO commenter_name
      FROM profiles
      WHERE id = NEW.user_id;

      INSERT INTO notifications (
        user_id,
        type,
        title,
        content,
        related_id,
        related_type,
        actor_id
      )
      VALUES (
        assumption_creator_id,
        'comment',
        'New comment',
        commenter_name || ' commented on your assumption',
        NEW.post_id,
        'assumption',
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
