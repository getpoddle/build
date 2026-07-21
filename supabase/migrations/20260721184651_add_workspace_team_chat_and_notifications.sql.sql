/*
# Add Workspace Team Chat and Notification Triggers

## Summary
Adds a team chat system for workspace members to communicate with each other (separate from the AI collaboration chat),
plus database triggers that automatically notify members when:
1. A team member accepts a workspace invite (notifies the inviter)
2. A team member posts a message in the team chat (notifies all other members)
3. A user posts in the AI collaboration chat (notifies workspace admins/owner)

## Changes

### 1. New Table: `workspace_chat_messages`
- `id` (uuid PK)
- `workspace_id` (uuid FK → workspaces, cascade delete)
- `user_id` (uuid FK → profiles, set null on delete)
- `content` (text, not null)
- `created_at` (timestamptz, default now())
This is a simple team chat — human-to-human messages only.

### 2. Notification Type CHECK constraint update
Adds `workspace_invite_accepted`, `workspace_team_message`, `workspace_ai_activity` to the allowed `notifications.type` values.
Adds `workspace`, `workspace_chat` to the allowed `notifications.related_type` values.

### 3. Trigger: `notify_inviter_on_invite_accepted`
- AFTER INSERT on `workspace_members`
- Only fires when the new member joined via an accepted invite (matched by email in `workspace_invites`)
- Inserts a notification for the user who sent the invite (`workspace_invites.invited_by`)
- Type: `workspace_invite_accepted`, related_type: `workspace`

### 4. Trigger: `notify_members_on_team_chat_message`
- AFTER INSERT on `workspace_chat_messages`
- Inserts a notification for every OTHER member of the workspace (not the sender)
- Type: `workspace_team_message`, related_type: `workspace_chat`

### 5. Trigger: `notify_admins_on_ai_chat_message`
- AFTER INSERT on `workspace_messages` where role = 'user'
- Inserts a notification for workspace admins/owner (role IN ('admin', 'owner')) who are NOT the sender
- Type: `workspace_ai_activity`, related_type: `workspace`

### 6. RLS Policies on `workspace_chat_messages`
- SELECT: workspace members can read
- INSERT: workspace members can insert their own messages
- DELETE: users can delete their own messages
*/

-- ── 1. Create workspace_chat_messages table ──
CREATE TABLE IF NOT EXISTS workspace_chat_messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES profiles(id) ON DELETE CASCADE,
  content       text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_workspace_chat_messages_workspace_id
  ON workspace_chat_messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_chat_messages_created_at
  ON workspace_chat_messages(workspace_id, created_at);

ALTER TABLE workspace_chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can read team chat" ON workspace_chat_messages;
CREATE POLICY "Workspace members can read team chat"
  ON workspace_chat_messages FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can send team chat" ON workspace_chat_messages;
CREATE POLICY "Workspace members can send team chat"
  ON workspace_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_member(workspace_id, auth.uid()) AND user_id = auth.uid());

DROP POLICY IF EXISTS "Users can delete own team chat messages" ON workspace_chat_messages;
CREATE POLICY "Users can delete own team chat messages"
  ON workspace_chat_messages FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ── 2. Update notification type CHECK constraint ──
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'message', 'reaction', 'comment', 'pod_invite',
    'follow', 'mention', 'referral', 'forecast_resolved',
    'workspace_invite_accepted', 'workspace_team_message', 'workspace_ai_activity'
  ));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_type_check
  CHECK (related_type IN (
    'message', 'insight', 'comment', 'conversation',
    'assumption', 'forecast', 'risk', 'scenario',
    'challenge', 'challenge_response',
    'workspace', 'workspace_chat'
  ));

-- ── 3. Trigger: notify inviter when a team member joins via invite ──
CREATE OR REPLACE FUNCTION notify_inviter_on_member_join()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_id uuid;
  v_workspace_name text;
  v_joiner_name text;
BEGIN
  -- Find the most recent accepted invite matching this workspace + the new member's email
  SELECT i.invited_by INTO v_inviter_id
  FROM workspace_invites i
  JOIN auth.users au ON au.email = i.invited_email
  WHERE i.workspace_id = NEW.workspace_id
    AND au.id = NEW.user_id
    AND i.accepted_at IS NOT NULL
  ORDER BY i.accepted_at DESC
  LIMIT 1;

  -- If no inviter found (e.g. owner creating workspace, or direct add), skip
  IF v_inviter_id IS NULL OR v_inviter_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_workspace_name FROM workspaces WHERE id = NEW.workspace_id;
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_joiner_name
  FROM profiles p JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.user_id;

  INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id, is_read)
  VALUES (
    v_inviter_id,
    'workspace_invite_accepted',
    'Team member joined',
    v_joiner_name || ' accepted your invitation to join ' || COALESCE(v_workspace_name, 'the workspace'),
    NEW.workspace_id,
    'workspace',
    NEW.user_id,
    false
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_inviter_on_member_join ON workspace_members;
CREATE TRIGGER trigger_notify_inviter_on_member_join
  AFTER INSERT ON workspace_members
  FOR EACH ROW EXECUTE FUNCTION notify_inviter_on_member_join();

-- ── 4. Trigger: notify other members on team chat message ──
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
  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_sender_name
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

DROP TRIGGER IF EXISTS trigger_notify_members_on_team_chat ON workspace_chat_messages;
CREATE TRIGGER trigger_notify_members_on_team_chat
  AFTER INSERT ON workspace_chat_messages
  FOR EACH ROW EXECUTE FUNCTION notify_members_on_team_chat();

-- ── 5. Trigger: notify admins/owner on AI collaboration chat activity ──
CREATE OR REPLACE FUNCTION notify_admins_on_ai_chat()
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
  -- Only notify on human messages (role = 'user'), not AI agent responses
  IF NEW.role IS DISTINCT FROM 'user' THEN
    RETURN NEW;
  END IF;

  -- If user_id is null (shouldn't happen for user role, but guard), skip
  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, split_part(email, '@', 1)) INTO v_sender_name
  FROM profiles p JOIN auth.users au ON au.id = p.id
  WHERE p.id = NEW.user_id;

  SELECT name INTO v_workspace_name FROM workspaces WHERE id = NEW.workspace_id;

  -- Notify admins and owner (not the sender)
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
$$;

DROP TRIGGER IF EXISTS trigger_notify_admins_on_ai_chat ON workspace_messages;
CREATE TRIGGER trigger_notify_admins_on_ai_chat
  AFTER INSERT ON workspace_messages
  FOR EACH ROW EXECUTE FUNCTION notify_admins_on_ai_chat();
