/*
  # Disable Rule-Based Agent Trigger

  The old rule-based trigger generated low-quality template responses on assumption insert.
  This is now replaced by the OpenAI-powered edge function (ai-agents/generate).
  Disabling the trigger prevents duplicate or low-quality responses from being inserted.
*/

DROP TRIGGER IF EXISTS trigger_agent_responses_on_assumption ON pod_assumptions;
