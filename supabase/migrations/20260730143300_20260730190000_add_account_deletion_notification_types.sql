/*
# Add account deletion + restoration notification types

Adds two new notification types:
- 'account_deletion_requested' — shown when a user requests account deletion
- 'account_restored' — shown when a user restores their account

Also adds 'account' to the allowed related_type values.
*/

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type IN (
    'message', 'reaction', 'comment', 'pod_invite', 'follow', 'mention',
    'referral', 'forecast_resolved', 'workspace_invite_accepted',
    'workspace_team_message', 'workspace_ai_activity', 'workspace_team_mention',
    'account_deletion_requested', 'account_restored'
  ));

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_related_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_related_type_check
  CHECK (related_type IN (
    'message', 'insight', 'comment', 'conversation', 'assumption',
    'forecast', 'risk', 'scenario', 'challenge', 'challenge_response',
    'workspace', 'workspace_chat', 'account'
  ));
