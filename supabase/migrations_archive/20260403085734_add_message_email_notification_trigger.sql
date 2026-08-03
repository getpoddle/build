/*
  # Add Message Email Notification Trigger

  ## Summary
  Adds a database trigger that fires an email notification whenever a new
  message is inserted into the `messages` table. The recipient is the other
  participant in the conversation, provided they have email notifications enabled.

  ## New Functions
  - `notify_new_message()` — trigger function on `messages` INSERT

  ## Notes
  - Looks up the conversation to find the other participant (not the sender)
  - Respects `email_notifications_enabled` on the recipient's profile
  - Uses pg_net (already enabled) to call the edge function asynchronously
  - Errors are caught and logged as warnings to never block message delivery
*/

CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipient_id  uuid;
  v_actor_name    text;
  v_enabled       boolean;
  v_url           text;
  v_anon_key      text;
BEGIN
  BEGIN
    SELECT
      CASE
        WHEN c.user_one_id = NEW.sender_id THEN c.user_two_id
        ELSE c.user_one_id
      END
    INTO v_recipient_id
    FROM conversations c
    WHERE c.id = NEW.conversation_id;

    IF v_recipient_id IS NULL THEN RETURN NEW; END IF;

    SELECT COALESCE(email_notifications_enabled, false)
      INTO v_enabled
    FROM profiles WHERE id = v_recipient_id;

    IF NOT v_enabled THEN RETURN NEW; END IF;

    SELECT COALESCE(first_name, split_part(full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles WHERE id = NEW.sender_id;

    v_url      := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    PERFORM extensions.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body    := jsonb_build_object(
        'type',             'message',
        'recipientUserId',  v_recipient_id::text,
        'actorName',        v_actor_name,
        'messageSnippet',   left(NEW.content, 200),
        'conversationId',   NEW.conversation_id::text
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_new_message error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();
