/*
  # Fix all email notification triggers to use net.http_post

  ## Problem
  All email notification trigger functions were calling `extensions.http_post()`
  which does not exist. The correct function is `net.http_post()` with a different
  calling convention:
    net.http_post(url, body, params, headers, timeout_milliseconds)

  This meant NO email notifications have ever been delivered via triggers.

  ## Fixed Functions
  - notify_insight_added
  - notify_challenge_posted
  - notify_follow_email
  - notify_mention_email
  - notify_new_message (message email trigger)
*/

-- 1. notify_insight_added
CREATE OR REPLACE FUNCTION notify_insight_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pod_name   text;
  v_actor_name text;
  v_member     record;
  v_url        text;
  v_anon_key   text;
BEGIN
  BEGIN
    SELECT p.name INTO v_pod_name FROM pods p WHERE p.id = NEW.pod_id;
    SELECT COALESCE(pr.first_name, split_part(pr.full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles pr WHERE pr.id = NEW.created_by;

    v_url      := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    FOR v_member IN
      SELECT pm.user_id
      FROM pod_members pm
      JOIN profiles pr ON pr.id = pm.user_id
      WHERE pm.pod_id = NEW.pod_id
        AND pm.user_id != NEW.created_by
        AND COALESCE(pr.email_notifications_enabled, false) = true
    LOOP
      PERFORM net.http_post(
        url     := v_url || '/functions/v1/send-notifications',
        body    := jsonb_build_object(
          'type',              'insight_added',
          'recipientUserId',   v_member.user_id::text,
          'actorName',         v_actor_name,
          'podName',           COALESCE(v_pod_name, 'a decision room'),
          'podId',             NEW.pod_id::text,
          'assumptionSnippet', left(NEW.content, 200)
        ),
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_insight_added error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 2. notify_challenge_posted
CREATE OR REPLACE FUNCTION notify_challenge_posted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_assumption record;
  v_pod_name   text;
  v_actor_name text;
  v_recipient  record;
  v_url        text;
  v_anon_key   text;
BEGIN
  BEGIN
    SELECT pa.created_by, pa.content, pa.pod_id
      INTO v_assumption
    FROM pod_assumptions pa WHERE pa.id = NEW.assumption_id;

    IF v_assumption.created_by IS NULL OR v_assumption.created_by = NEW.user_id THEN
      RETURN NEW;
    END IF;

    SELECT COALESCE(pr.email_notifications_enabled, false)
      INTO v_recipient
    FROM profiles pr WHERE pr.id = v_assumption.created_by;

    IF NOT v_recipient.email_notifications_enabled THEN
      RETURN NEW;
    END IF;

    SELECT p.name INTO v_pod_name FROM pods p WHERE p.id = v_assumption.pod_id;
    SELECT COALESCE(pr.first_name, split_part(pr.full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles pr WHERE pr.id = NEW.user_id;

    v_url      := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      body    := jsonb_build_object(
        'type',              'challenge',
        'recipientUserId',   v_assumption.created_by::text,
        'actorName',         v_actor_name,
        'podName',           COALESCE(v_pod_name, 'a decision room'),
        'podId',             v_assumption.pod_id::text,
        'assumptionSnippet', left(v_assumption.content, 200)
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_challenge_posted error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 3. notify_follow_email
CREATE OR REPLACE FUNCTION notify_follow_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_name text;
  v_url        text;
  v_anon_key   text;
  v_enabled    boolean;
BEGIN
  BEGIN
    SELECT COALESCE(email_notifications_enabled, false)
      INTO v_enabled
    FROM profiles WHERE id = NEW.following_id;

    IF NOT v_enabled THEN RETURN NEW; END IF;

    SELECT COALESCE(first_name, split_part(full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles WHERE id = NEW.follower_id;

    v_url      := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      body    := jsonb_build_object(
        'type',            'follow',
        'recipientUserId', NEW.following_id::text,
        'actorName',       v_actor_name
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_follow_email error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 4. notify_mention_email
CREATE OR REPLACE FUNCTION notify_mention_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_actor_name text;
  v_url        text;
  v_anon_key   text;
  v_enabled    boolean;
BEGIN
  IF NEW.type != 'mention' THEN RETURN NEW; END IF;

  BEGIN
    SELECT COALESCE(email_notifications_enabled, false)
      INTO v_enabled
    FROM profiles WHERE id = NEW.user_id;

    IF NOT v_enabled THEN RETURN NEW; END IF;

    SELECT COALESCE(first_name, split_part(full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles WHERE id = NEW.actor_id;

    v_url      := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      body    := jsonb_build_object(
        'type',            'mention',
        'recipientUserId', NEW.user_id::text,
        'actorName',       v_actor_name,
        'actorId',         COALESCE(NEW.related_type, 'mention'),
        'podId',           COALESCE(NEW.related_id::text, '')
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_mention_email error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

-- 5. notify_new_message (message email)
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_recipient_id uuid;
  v_actor_name   text;
  v_enabled      boolean;
  v_url          text;
  v_anon_key     text;
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

    -- In-app notification
    INSERT INTO notifications (user_id, type, title, content, actor_id, related_id, related_type)
    VALUES (
      v_recipient_id,
      'message',
      'New message',
      left(NEW.content, 100),
      NEW.sender_id,
      NEW.conversation_id,
      'conversation'
    )
    ON CONFLICT DO NOTHING;

    -- Email notification
    SELECT COALESCE(email_notifications_enabled, false)
      INTO v_enabled
    FROM profiles WHERE id = v_recipient_id;

    IF NOT v_enabled THEN RETURN NEW; END IF;

    SELECT COALESCE(first_name, split_part(full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles WHERE id = NEW.sender_id;

    v_url      := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      body    := jsonb_build_object(
        'type',            'message',
        'recipientUserId', v_recipient_id::text,
        'actorName',       v_actor_name,
        'messageSnippet',  left(NEW.content, 200),
        'conversationId',  NEW.conversation_id::text
      ),
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_new_message error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;
