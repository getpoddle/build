/*
  # Add missing performance indexes

  ## Problem
  Several high-traffic foreign key columns and query patterns lack indexes,
  causing full table scans at scale.

  ## Changes
  1. workspace_messages.user_id — needed for "messages by user" queries
  2. war_room_action_items.synthesis_run_id — needed for action item lookups
  3. war_room_action_items.assigned_to — needed for "my action items" queries
  4. workspace_synthesis.workspace_id — already likely indexed but ensure it exists
  5. workspace_invites.token — needed for token lookup (critical auth path)
  6. workspace_invites.workspace_id — needed for seat-count queries
*/

CREATE INDEX IF NOT EXISTS idx_workspace_messages_user_id
  ON workspace_messages(user_id);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_token
  ON workspace_invites(token);

CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id
  ON workspace_invites(workspace_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'war_room_action_items'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_war_room_action_items_synthesis_run_id
      ON war_room_action_items(synthesis_run_id)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_war_room_action_items_assigned_to
      ON war_room_action_items(assigned_to)';
  END IF;
END $$;
