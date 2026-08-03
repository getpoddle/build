/*
  # Add Email Notification Triggers

  ## Summary
  Sets up database triggers and a cron-style mechanism to fire emails via the
  new `send-notifications` edge function for the following events:

  1. **Insight added** — when a new assumption is posted in a pod, all other pod
     members who have email notifications enabled receive an email.
  2. **Challenge posted** — when someone challenges an assumption, the assumption
     author gets an email.
  3. **Follow** — when a user is followed, they get an email.
  4. **Mention** — already handled by the existing `send-mention-email` trigger;
     this migration replaces it with the unified function.
  5. **Weekly digest** — a `send_weekly_digest_emails` function that can be called
     by a scheduled job (or manually) to send digest emails to all users who have
     a current-week digest in `weekly_digests`.

  ## New Functions
  - `notify_insight_added()` — trigger function on `pod_assumptions` INSERT
  - `notify_challenge_posted()` — trigger function on `assumption_challenges` INSERT
  - `notify_follow()` — trigger function on `followers` INSERT
  - `notify_mention_unified()` — replaces old mention trigger, uses unified function
  - `send_weekly_digest_emails()` — callable function to dispatch digest emails

  ## Notes
  - All functions use `pg_net` (already enabled) to call the edge function asynchronously
  - The edge function URL is derived from `current_setting('app.settings.supabase_url', true)`
    with a fallback built from `current_setting('app.settings.supabase_project_ref', true)`
  - Each function is SECURITY DEFINER with restricted search_path
  - Errors are caught and logged as warnings so they never block the main transaction
*/

-- Helper to get the edge function base URL safely
CREATE OR REPLACE FUNCTION get_supabase_url()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_url text;
BEGIN
  v_url := current_setting('app.settings.supabase_url', true);
  IF v_url IS NULL OR v_url = '' THEN
    v_url := current_setting('app.settings', true)::json->>'supabase_url';
  END IF;
  RETURN COALESCE(v_url, '');
END;
$$;

-- Helper to get the service-role / anon key for internal calls
CREATE OR REPLACE FUNCTION get_supabase_anon_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_key text;
BEGIN
  v_key := current_setting('app.settings.supabase_anon_key', true);
  IF v_key IS NULL OR v_key = '' THEN
    v_key := current_setting('app.settings', true)::json->>'supabase_anon_key';
  END IF;
  RETURN COALESCE(v_key, '');
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- 1. INSIGHT ADDED — notify all pod members except the poster
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_insight_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_pod_name    text;
  v_actor_name  text;
  v_member      record;
  v_url         text;
  v_anon_key    text;
BEGIN
  BEGIN
    SELECT p.name INTO v_pod_name FROM pods p WHERE p.id = NEW.pod_id;
    SELECT COALESCE(pr.first_name, split_part(pr.full_name, ' ', 1), 'Someone')
      INTO v_actor_name
    FROM profiles pr WHERE pr.id = NEW.created_by;

    v_url     := get_supabase_url();
    v_anon_key := get_supabase_anon_key();

    FOR v_member IN
      SELECT pm.user_id
      FROM pod_members pm
      JOIN profiles pr ON pr.id = pm.user_id
      WHERE pm.pod_id = NEW.pod_id
        AND pm.user_id != NEW.created_by
        AND COALESCE(pr.email_notifications_enabled, false) = true
    LOOP
      PERFORM extensions.http_post(
        url     := v_url || '/functions/v1/send-notifications',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body    := jsonb_build_object(
          'type',               'insight_added',
          'recipientUserId',    v_member.user_id::text,
          'actorName',          v_actor_name,
          'podName',            COALESCE(v_pod_name, 'a decision room'),
          'podId',              NEW.pod_id::text,
          'assumptionSnippet',  left(NEW.content, 200)
        )
      );
    END LOOP;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_insight_added error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_insight_added ON pod_assumptions;
CREATE TRIGGER trigger_notify_insight_added
  AFTER INSERT ON pod_assumptions
  FOR EACH ROW
  EXECUTE FUNCTION notify_insight_added();

-- ─────────────────────────────────────────────────────────────
-- 2. CHALLENGE POSTED — notify the assumption author
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_challenge_posted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_assumption  record;
  v_pod_name    text;
  v_actor_name  text;
  v_recipient   record;
  v_url         text;
  v_anon_key    text;
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

    PERFORM extensions.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body    := jsonb_build_object(
        'type',               'challenge',
        'recipientUserId',    v_assumption.created_by::text,
        'actorName',          v_actor_name,
        'podName',            COALESCE(v_pod_name, 'a decision room'),
        'podId',              v_assumption.pod_id::text,
        'assumptionSnippet',  left(v_assumption.content, 200)
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_challenge_posted error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_challenge_posted ON assumption_challenges;
CREATE TRIGGER trigger_notify_challenge_posted
  AFTER INSERT ON assumption_challenges
  FOR EACH ROW
  EXECUTE FUNCTION notify_challenge_posted();

-- ─────────────────────────────────────────────────────────────
-- 3. FOLLOW — notify the followed user
-- ─────────────────────────────────────────────────────────────

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

    PERFORM extensions.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body    := jsonb_build_object(
        'type',            'follow',
        'recipientUserId', NEW.following_id::text,
        'actorName',       v_actor_name
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_follow_email error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_follow_email ON followers;
CREATE TRIGGER trigger_notify_follow_email
  AFTER INSERT ON followers
  FOR EACH ROW
  EXECUTE FUNCTION notify_follow_email();

-- ─────────────────────────────────────────────────────────────
-- 4. MENTION — replace old trigger with unified function
-- ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trigger_send_mention_email ON notifications;
DROP FUNCTION IF EXISTS send_mention_email_notification() CASCADE;

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

    PERFORM extensions.http_post(
      url     := v_url || '/functions/v1/send-notifications',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body    := jsonb_build_object(
        'type',            'mention',
        'recipientUserId', NEW.user_id::text,
        'actorName',       v_actor_name,
        'actorId',         COALESCE(NEW.related_type, 'mention'),
        'podId',           COALESCE(NEW.related_id::text, '')
      )
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_mention_email error: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_mention_email ON notifications;
CREATE TRIGGER trigger_notify_mention_email
  AFTER INSERT ON notifications
  FOR EACH ROW
  WHEN (NEW.type = 'mention')
  EXECUTE FUNCTION notify_mention_email();

-- ─────────────────────────────────────────────────────────────
-- 5. WEEKLY DIGEST — callable function to batch-send emails
--    Call this from a cron job or manually each Monday morning
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION send_weekly_digest_emails()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_digest   record;
  v_enabled  boolean;
  v_url      text;
  v_anon_key text;
  v_count    integer := 0;
  v_week_start date;
BEGIN
  v_week_start := date_trunc('week', now())::date;
  v_url        := get_supabase_url();
  v_anon_key   := get_supabase_anon_key();

  FOR v_digest IN
    SELECT wd.user_id, wd.top_assumptions, wd.ai_highlights,
           wd.pod_changes, wd.summary_text, wd.week_start
    FROM weekly_digests wd
    JOIN profiles pr ON pr.id = wd.user_id
    WHERE wd.week_start >= v_week_start
      AND COALESCE(pr.email_notifications_enabled, false) = true
  LOOP
    BEGIN
      PERFORM extensions.http_post(
        url     := v_url || '/functions/v1/send-notifications',
        headers := jsonb_build_object(
          'Content-Type',  'application/json',
          'Authorization', 'Bearer ' || v_anon_key
        ),
        body    := jsonb_build_object(
          'type',            'weekly_digest',
          'recipientUserId', v_digest.user_id::text,
          'digestData',      jsonb_build_object(
            'top_assumptions', v_digest.top_assumptions,
            'ai_highlights',   v_digest.ai_highlights,
            'pod_changes',     v_digest.pod_changes,
            'summary_text',    COALESCE(v_digest.summary_text, ''),
            'week_start',      v_digest.week_start::text
          )
        )
      );
      v_count := v_count + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'send_weekly_digest_emails error for user %: %', v_digest.user_id, SQLERRM;
    END;
  END LOOP;

  RETURN v_count;
END;
$$;
