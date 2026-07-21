/*
# Remove duplicate invite_accepted trigger

The accept-workspace-invite edge function already inserts a `workspace_invite_accepted` 
notification (and sends an email). The database trigger `notify_inviter_on_member_join` 
would create a duplicate notification. Removing the trigger; the edge function is the 
single source of truth for invite-accepted notifications.
*/

DROP TRIGGER IF EXISTS trigger_notify_inviter_on_member_join ON workspace_members;
DROP FUNCTION IF EXISTS notify_inviter_on_member_join();
