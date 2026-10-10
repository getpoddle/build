-- Fix: The decision_events_event_type_check constraint was missing
-- 'team_note', 'evidence_revised', 'evidence_verified', and 'snapshot_created'.
-- These event types are used by the frontend and RPC functions but were never
-- added to the CHECK constraint, causing INSERTs to fail with a constraint violation.

ALTER TABLE decision_events DROP CONSTRAINT IF EXISTS decision_events_event_type_check;

ALTER TABLE decision_events ADD CONSTRAINT decision_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'decision_created',
    'evidence_added',
    'agent_analysis',
    'challenge_raised',
    'human_override',
    'final_decision',
    'outcome_logged',
    'team_note',
    'evidence_revised',
    'evidence_verified',
    'snapshot_created'
  ]));
