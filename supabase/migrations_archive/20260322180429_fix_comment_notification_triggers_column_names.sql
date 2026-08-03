/*
  # Fix Comment Notification Triggers - Column Names
  
  ## Overview
  Updates comment notification functions to use correct column names.
  Comments table has: insight_id (not post_id), author_id (not user_id)
  
  ## Changes
  - Fix notify_assumption_comment to use correct column names
  - Fix notify_insight_comment to use correct column names
*/

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
  -- Check if this comment is on an assumption (insight_id matches a pod_assumption)
  SELECT EXISTS(
    SELECT 1 FROM pod_assumptions WHERE id = NEW.insight_id
  ) INTO assumption_exists;
  
  IF assumption_exists THEN
    SELECT pa.created_by INTO assumption_creator_id
    FROM pod_assumptions pa
    WHERE pa.id = NEW.insight_id;
    
    -- Only notify if commenter is not the assumption creator
    IF assumption_creator_id IS NOT NULL AND assumption_creator_id != NEW.author_id THEN
      SELECT full_name INTO commenter_name
      FROM profiles
      WHERE id = NEW.author_id;
      
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
        NEW.insight_id,
        'assumption',
        NEW.author_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_insight_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  post_author_id uuid;
  commenter_name text;
BEGIN
  -- Get the post author
  SELECT i.author_id INTO post_author_id
  FROM insights i
  WHERE i.id = NEW.insight_id;
  
  -- Only notify if commenter is different from post author
  IF post_author_id IS NOT NULL AND post_author_id != NEW.author_id THEN
    SELECT full_name INTO commenter_name
    FROM profiles
    WHERE id = NEW.author_id;
    
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
      post_author_id,
      'comment',
      'New comment',
      commenter_name || ' commented on your post',
      NEW.insight_id,
      'insight',
      NEW.author_id
    );
  END IF;
  
  RETURN NEW;
END;
$$;
