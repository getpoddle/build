/*
# Fix ambiguous column reference in team chat notification triggers

## Problem
Both `profiles` and `auth.users` have an `email` column. The trigger functions
`notify_members_on_team_chat` and `notify_mentioned_members` use `split_part(email, '@', 1)`
in a JOIN between these two tables, causing an ambiguous column reference error.
This error rolls back the INSERT on `workspace_chat_messages`, so messages fail to send.

## Fix
Qualify the `email` column reference as `au.email` (from `auth.users`) in both functions.
*/

CREATE OR REPLACE FUNCTION notify_members_on_team_chat()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member RECORD;
  v_sender_name text;
  v_workspace_name text;
BEGIN
  SELECT COALESCE(p.full_name, split_part(au.email, '@', 1)) INTO v_sender_name
  FROM profiles p JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.user_id;

  SELECT name INTO v_workspace_name FROM workspaces WHERE id = NEW.workspace_id;

  FOR v_member IN
    SELECT user_id FROM workspace_members
    WHERE workspace_id = NEW.workspace_id
    AND user_id != NEW.user_id
  LOOP
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id, is_read)
    VALUES (
      v_member.user_id,
      'workspace_team_message',
      'New team message',
      v_sender_name || ' posted in ' || COALESCE(v_workspace_name, 'workspace') || ' team chat',
      NEW.workspace_id,
      'workspace_chat',
      NEW.user_id,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION notify_mentioned_members()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mentioned_id uuid;
  v_sender_name text;
  v_workspace_name text;
BEGIN
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(p.full_name, split_part(au.email, '@', 1)) INTO v_sender_name
  FROM profiles p JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.user_id;

  SELECT name INTO v_workspace_name FROM workspaces WHERE id = NEW.workspace_id;

  FOREACH v_mentioned_id IN ARRAY NEW.mentioned_user_ids LOOP
    IF v_mentioned_id = NEW.user_id THEN
      CONTINUE;
    END IF;

    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id, is_read)
    VALUES (
      v_mentioned_id,
      'workspace_team_mention',
      'You were mentioned',
      v_sender_name || ' mentioned you in ' || COALESCE(v_workspace_name, 'workspace') || ' team chat',
      NEW.workspace_id,
      'workspace_chat',
      NEW.user_id,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$$;
