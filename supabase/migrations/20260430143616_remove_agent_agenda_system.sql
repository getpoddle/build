/*
  # Remove Agent Agenda system

  1. Changes
    - Drop triggers and functions associated with the agent_agenda_* tables.
    - Drop the agent_agenda_nudge_votes, agent_agenda_nudges,
      agent_agenda_votes, and agent_agenda_topics tables.

  2. Notes
    - The feature was rolled back because it introduced a runtime crash path
      on mobile. All dependent data is removed with the tables.
*/

DROP TRIGGER IF EXISTS agent_agenda_votes_recount ON agent_agenda_votes;
DROP TRIGGER IF EXISTS agent_agenda_nudge_votes_recount ON agent_agenda_nudge_votes;
DROP TRIGGER IF EXISTS agent_agenda_topics_set_updated_at ON agent_agenda_topics;

DROP FUNCTION IF EXISTS trg_agenda_votes_recount() CASCADE;
DROP FUNCTION IF EXISTS trg_agenda_nudge_votes_recount() CASCADE;
DROP FUNCTION IF EXISTS trg_agent_agenda_topics_set_updated_at() CASCADE;
DROP FUNCTION IF EXISTS recompute_agenda_topic_counts(uuid) CASCADE;

DROP TABLE IF EXISTS agent_agenda_nudge_votes CASCADE;
DROP TABLE IF EXISTS agent_agenda_nudges CASCADE;
DROP TABLE IF EXISTS agent_agenda_votes CASCADE;
DROP TABLE IF EXISTS agent_agenda_topics CASCADE;
