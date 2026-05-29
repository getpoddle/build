/*
  # Fix Function Search Paths for Notification Functions

  1. Changes
    - Set explicit search_path for all notification trigger functions
    - Prevents role mutable search_path security issues
    - Ensures functions always use the correct schema

  2. Functions Updated
    - trigger_message_email
    - notify_challenge_mention
    - notify_risk_comment
    - notify_challenge_response
    - notify_assumption_mention
    - notify_forecast_comment
    - notify_scenario_comment
    - notify_assumption_comment

  3. Security Impact
    - Prevents potential privilege escalation attacks
    - Ensures consistent function behavior regardless of role's search_path
*/

-- Fix trigger_message_email function
CREATE OR REPLACE FUNCTION trigger_message_email()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  recipient_email text;
  recipient_name text;
  sender_name text;
  recipient_email_enabled boolean;
BEGIN
  SELECT p.email, p.full_name, p.email_notifications_enabled
  INTO recipient_email, recipient_name, recipient_email_enabled
  FROM profiles p
  WHERE p.id = NEW.receiver_id;

  SELECT p.full_name INTO sender_name
  FROM profiles p
  WHERE p.id = NEW.sender_id;

  IF recipient_email_enabled THEN
    INSERT INTO email_notification_queue (
      user_id,
      email,
      subject,
      body,
      notification_type
    )
    VALUES (
      NEW.receiver_id,
      recipient_email,
      'New message from ' || sender_name,
      'You have received a new message from ' || sender_name || ': ' || 
      SUBSTRING(NEW.content, 1, 100) || 
      CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
      'message'
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Fix notify_assumption_mention function
CREATE OR REPLACE FUNCTION notify_assumption_mention()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  mentioner_name text;
BEGIN
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = NEW.mentioned_by_user_id;

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
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    mentioner_name || ' mentioned you in an assumption',
    NEW.assumption_id,
    'assumption',
    NEW.mentioned_by_user_id
  );
  
  RETURN NEW;
END;
$$;

-- Fix notify_challenge_mention function
CREATE OR REPLACE FUNCTION notify_challenge_mention()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  mentioner_name text;
BEGIN
  SELECT full_name INTO mentioner_name
  FROM profiles
  WHERE id = NEW.mentioned_by_user_id;

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
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    mentioner_name || ' mentioned you in a challenge',
    NEW.challenge_id,
    'challenge',
    NEW.mentioned_by_user_id
  );
  
  RETURN NEW;
END;
$$;

-- Fix notify_forecast_comment function
CREATE OR REPLACE FUNCTION notify_forecast_comment()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  forecast_creator_id uuid;
  commenter_name text;
BEGIN
  SELECT af.user_id INTO forecast_creator_id
  FROM assumption_forecasts af
  WHERE af.id = NEW.forecast_id;
  
  IF forecast_creator_id != NEW.user_id THEN
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
      forecast_creator_id,
      'comment',
      'New comment',
      commenter_name || ' commented on your forecast',
      NEW.forecast_id,
      'forecast',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;

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
  SELECT ar.user_id INTO risk_creator_id
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
  SELECT ass.user_id INTO scenario_creator_id
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
    SELECT pa.user_id INTO assumption_creator_id
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

-- Fix notify_challenge_response function
CREATE OR REPLACE FUNCTION notify_challenge_response()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  challenge_creator_id uuid;
  responder_name text;
BEGIN
  SELECT c.created_by INTO challenge_creator_id
  FROM challenges c
  WHERE c.id = NEW.challenge_id;
  
  IF challenge_creator_id != NEW.user_id THEN
    SELECT full_name INTO responder_name
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
      challenge_creator_id,
      'comment',
      'New response',
      responder_name || ' responded to your challenge',
      NEW.challenge_id,
      'challenge',
      NEW.user_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;
