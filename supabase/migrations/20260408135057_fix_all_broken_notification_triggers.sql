/*
  # Fix All Broken Notification Triggers

  ## Summary
  Several notification trigger functions had incorrect column references that caused
  silent failures, meaning mentions and messages were not always delivering notifications.

  ## Problems Fixed

  1. `create_mention_notification` — was inserting into non-existent columns
     `related_user_id` and `related_comment_id`. Fixed to use correct columns
     `actor_id` and `related_id`/`related_type`.

  2. `notify_challenge_response_mention` — had `title` and `content` values swapped,
     meaning the notification title showed body text and vice versa.

  3. `trigger_send_message_email` — was a disabled no-op stub that still fired on
     every message insert. Dropped to avoid confusion; the working
     `trigger_notify_new_message` already handles this correctly.

  ## No data is dropped or altered — only function definitions and one dead trigger.
*/

-- 1. Fix create_mention_notification (was using wrong column names)
CREATE OR REPLACE FUNCTION create_mention_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentioner_name text;
BEGIN
  SELECT full_name INTO v_mentioner_name
  FROM profiles WHERE id = NEW.mentioned_by_user_id;

  INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    COALESCE(v_mentioner_name, 'Someone') || ' mentioned you in a comment',
    NEW.comment_id,
    'comment',
    NEW.mentioned_by_user_id
  );

  RETURN NEW;
END;
$$;

-- 2. Fix notify_challenge_response_mention (title and content were swapped)
CREATE OR REPLACE FUNCTION notify_challenge_response_mention()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentioner_name text;
BEGIN
  SELECT full_name INTO v_mentioner_name
  FROM profiles WHERE id = NEW.mentioned_by_user_id;

  INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id, created_at)
  VALUES (
    NEW.mentioned_user_id,
    'mention',
    'You were mentioned',
    COALESCE(v_mentioner_name, 'Someone') || ' mentioned you in a challenge response',
    NEW.response_id,
    'challenge_response',
    NEW.mentioned_by_user_id,
    now()
  );

  RETURN NEW;
END;
$$;

-- 3. Drop the dead no-op trigger_send_message_email stub
DROP TRIGGER IF EXISTS trigger_send_message_email ON messages;
DROP FUNCTION IF EXISTS trigger_message_email();
