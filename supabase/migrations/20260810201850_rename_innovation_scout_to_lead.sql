/*
# Rename "Innovation Scout" to "Innovation Lead" in existing data

Updates agent_name in workspace_messages so historical AI responses display
the new name. No schema changes — only a string update on existing rows.
*/

UPDATE workspace_messages
  SET agent_name = 'Innovation Lead'
  WHERE agent_name = 'Innovation Scout';