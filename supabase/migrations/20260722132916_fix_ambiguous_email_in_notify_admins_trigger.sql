/*
# Fix Ambiguous Column in notify_admins_on_ai_chat Trigger

## Problem
The `notify_admins_on_ai_chat` trigger function joins `profiles` with `auth.users`
but references `email` without a table alias. Both tables have an `email` column,
causing a "column reference is ambiguous" error that silently aborts every
`workspace_messages` INSERT where role = 'user'.

This broke all Slack /poddle commands and Lens submissions — the workspace was
created but the opening message was never inserted, so synthesis had nothing
to process.

## Fix
Qualify the `email` column with the `p` alias: `p.email`.
*/

CREATE OR REPLACE FUNCTION public.notify_admins_on_ai_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_member RECORD;
  v_sender_name text;
  v_workspace_name text;
BEGIN
  IF NEW.role IS DISTINCT FROM 'user' THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, split_part(p.email, '@', 1)) INTO v_sender_name
  FROM profiles p JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.user_id;

  SELECT name INTO v_workspace_name FROM workspaces WHERE id = NEW.workspace_id;

  FOR v_member IN
    SELECT user_id FROM workspace_members
    WHERE workspace_id = NEW.workspace_id
    AND user_id != NEW.user_id
    AND role IN ('admin', 'owner')
  LOOP
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id, is_read)
    VALUES (
      v_member.user_id,
      'workspace_ai_activity',
      'AI collaboration activity',
      v_sender_name || ' started a session in ' || COALESCE(v_workspace_name, 'workspace'),
      NEW.workspace_id,
      'workspace',
      NEW.user_id,
      false
    );
  END LOOP;

  RETURN NEW;
END;
$function$;
