/*
  # Fix Strategic Content Notifications

  1. Changes
    - Update notifications table to support 'mention' type and include all existing types
    - Fix notification triggers for forecasts, risks, scenarios, and assumptions
    - Ensure triggers use correct notification schema (title, content, related_id, related_type, actor_id)
    - Add notification triggers for challenge responses

  2. Security
    - All triggers use SECURITY DEFINER to ensure they can insert notifications
    - Notifications are only created for content creators (not for self-comments)
*/

-- Update notification type check to include all types
DO $$
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('message', 'reaction', 'comment', 'pod_invite', 'follow', 'mention', 'referral'));
END $$;

-- Update related_type check to include strategic content types
DO $$
BEGIN
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_type_check;
  ALTER TABLE notifications ADD CONSTRAINT notifications_related_type_check 
    CHECK (related_type IN ('message', 'insight', 'comment', 'conversation', 'assumption', 'forecast', 'risk', 'scenario', 'challenge', 'challenge_response'));
END $$;

-- Fix notification trigger for assumption mentions
CREATE OR REPLACE FUNCTION notify_assumption_mention()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_assumption_mention ON assumption_mentions;
CREATE TRIGGER trigger_assumption_mention
  AFTER INSERT ON assumption_mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_assumption_mention();

-- Fix notification trigger for challenge mentions
CREATE OR REPLACE FUNCTION notify_challenge_mention()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_challenge_mention ON challenge_mentions;
CREATE TRIGGER trigger_challenge_mention
  AFTER INSERT ON challenge_mentions
  FOR EACH ROW
  EXECUTE FUNCTION notify_challenge_mention();

-- Fix notification trigger for forecast comments
CREATE OR REPLACE FUNCTION notify_forecast_comment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_forecast_comment ON forecast_comments;
CREATE TRIGGER trigger_forecast_comment
  AFTER INSERT ON forecast_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_forecast_comment();

-- Fix notification trigger for risk comments
CREATE OR REPLACE FUNCTION notify_risk_comment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_risk_comment ON risk_comments;
CREATE TRIGGER trigger_risk_comment
  AFTER INSERT ON risk_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_risk_comment();

-- Fix notification trigger for scenario comments
CREATE OR REPLACE FUNCTION notify_scenario_comment()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_scenario_comment ON scenario_comments;
CREATE TRIGGER trigger_scenario_comment
  AFTER INSERT ON scenario_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_scenario_comment();

-- Fix notification for comments on assumptions (using existing comments table)
CREATE OR REPLACE FUNCTION notify_assumption_comment()
RETURNS TRIGGER AS $$
DECLARE
  assumption_creator_id uuid;
  assumption_exists boolean;
  commenter_name text;
BEGIN
  -- Check if this comment is on an assumption
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_assumption_comment ON comments;
CREATE TRIGGER trigger_assumption_comment
  AFTER INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_assumption_comment();

-- Add notification for challenge responses (comments on challenges)
CREATE OR REPLACE FUNCTION notify_challenge_response()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_challenge_response ON challenge_responses;
CREATE TRIGGER trigger_challenge_response
  AFTER INSERT ON challenge_responses
  FOR EACH ROW
  EXECUTE FUNCTION notify_challenge_response();
