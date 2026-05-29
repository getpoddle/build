/*
  # Backfill Agent Discussion Participant Names

  ## Summary
  Updates existing ai_agent_discussions rows to include all participant agent names
  and display names from their discussion turns, not just the initial poster.

  ## Changes
  - Updates agent_names (jsonb) and agent_display_names (jsonb) arrays on all discussions
    to reflect every agent that participated in the discussion turns
*/

UPDATE ai_agent_discussions d
SET
  agent_names = (
    SELECT to_jsonb(array_agg(t.agent_name ORDER BY t.turn_number))
    FROM ai_agent_discussion_turns t
    WHERE t.discussion_id = d.id
  ),
  agent_display_names = (
    SELECT to_jsonb(array_agg(t.display_name ORDER BY t.turn_number))
    FROM ai_agent_discussion_turns t
    WHERE t.discussion_id = d.id
  )
WHERE EXISTS (
  SELECT 1 FROM ai_agent_discussion_turns t WHERE t.discussion_id = d.id
);
