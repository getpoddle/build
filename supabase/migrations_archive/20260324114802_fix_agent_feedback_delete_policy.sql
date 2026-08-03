/*
  # Fix Agent Feedback Delete Policy

  ## Problem
  The agent_feedback table has no DELETE policy, so when users try to
  toggle off their feedback (remove it), the delete silently fails.

  ## Changes
  - Add DELETE policy for agent_feedback so users can remove their own feedback
*/

CREATE POLICY "Users can delete their own feedback"
  ON agent_feedback FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
