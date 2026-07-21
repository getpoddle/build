/*
# Add @mention support to workspace team chat

## Summary
Adds the ability for team chat messages to tag (@mention) specific workspace members.
When a user is mentioned, they receive an in-app notification.

## Changes

### 1. New column on `workspace_chat_messages`
- `mentioned_user_ids` (uuid[], default '{}') — stores the user IDs of members mentioned in the message.

### 2. New notification type
Adds `workspace_team_mention` to the allowed `notifications.type` values.

### 3. Trigger: `notify_mentioned_members`
- AFTER INSERT on `workspace_chat_messages`
- For each user ID in `mentioned_user_ids` (excluding the sender), inserts a notification:
  - type: `workspace_team_mention`
  - related_type: `workspace_chat`
  - related_id: the workspace_id
  - actor_id: the sender
  - content: "{sender} mentioned you in {workspace} team chat"

## Security
- No RLS changes needed; the column is readable by workspace members via the existing SELECT policy.
- The trigger function is SECURITY DEFINER so it can insert notifications on behalf of the mentioned users.
*/

-- ── 1. Add mentioned_user_ids column ──
ALTER TABLE workspace_chat_messages
  ADD COLUMN IF NOT EXISTS mentioned_user_ids uuid[] DEFAULT '{}'::uuid[];

-- ── 2. Update notification type CHECK constraint ──
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'message', 'reaction', 'comment', 'pod_invite',
    'follow', 'mention', 'referral', 'forecast_resolved',
    'workspace_invite_accepted', 'workspace_team_message', 'workspace_ai_activity',
    'workspace_team_mention'
  ));

-- ── 3. Trigger: notify mentioned members ──
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
  -- Only proceed if there are mentioned users
  IF NEW.mentioned_user_ids IS NULL OR array_length(NEW.mentioned_user_ids, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get sender display name
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_sender_name
  FROM profiles p JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.user_id;

  -- Get workspace name
  SELECT name INTO v_workspace_name FROM workspaces WHERE id = NEW.workspace_id;

  -- Insert a notification for each mentioned user (excluding sender)
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

DROP TRIGGER IF EXISTS trigger_notify_mentioned_members ON workspace_chat_messages;
CREATE TRIGGER trigger_notify_mentioned_members
  AFTER INSERT ON workspace_chat_messages
  FOR EACH ROW EXECUTE FUNCTION notify_mentioned_members();
