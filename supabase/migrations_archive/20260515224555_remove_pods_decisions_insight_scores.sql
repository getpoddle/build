/*
  # Remove Pods, Decisions, and Insight Score Systems

  1. Schema Changes
    - Remove FK constraints and RLS policies referencing pod_id from reasoning entities
    - Drop pod_id columns from problems, ideas, predictions
    - Drop all pod-related tables
    - Drop all decision-related tables  
    - Drop insight_events and user_reputation tables

  2. Tables Dropped
    - pods, pod_members, pod_assumptions, pod_evidence, pod_evidence_votes,
      pod_forecasts, pod_options, pod_risks
    - decision_threads and all related tables
    - insight_events, insight_likes, insights, user_reputation
    - post_tags, post_ai_insights
    - All assumption_* tables, agent_consensus, agent_conversations, etc.

  3. Notes
    - problems, ideas, predictions tables are preserved
    - pod_id column removed since pods no longer exist
    - New simple RLS policies added for the entity tables
*/

-- Drop RLS policies on problems that reference pod_id
DROP POLICY IF EXISTS "Pod members can create problems" ON problems;
DROP POLICY IF EXISTS "Authenticated users can read problems" ON problems;
DROP POLICY IF EXISTS "Anyone can read problems in public pods" ON problems;
DROP POLICY IF EXISTS "Pod members can update problems" ON problems;
DROP POLICY IF EXISTS "Pod members can delete problems" ON problems;

-- Drop RLS policies on ideas that reference pod_id
DROP POLICY IF EXISTS "Pod members can create ideas" ON ideas;
DROP POLICY IF EXISTS "Authenticated users can read ideas" ON ideas;
DROP POLICY IF EXISTS "Anyone can read ideas in public pods" ON ideas;
DROP POLICY IF EXISTS "Pod members can update ideas" ON ideas;
DROP POLICY IF EXISTS "Pod members can delete ideas" ON ideas;

-- Drop RLS policies on predictions that reference pod_id
DROP POLICY IF EXISTS "Pod members can create predictions" ON predictions;
DROP POLICY IF EXISTS "Authenticated users can read predictions" ON predictions;
DROP POLICY IF EXISTS "Anyone can read predictions in public pods" ON predictions;
DROP POLICY IF EXISTS "Pod members can update predictions" ON predictions;
DROP POLICY IF EXISTS "Pod members can delete predictions" ON predictions;

-- Now remove FK constraints from reasoning entity tables
ALTER TABLE IF EXISTS problems DROP CONSTRAINT IF EXISTS problems_pod_id_fkey;
ALTER TABLE IF EXISTS ideas DROP CONSTRAINT IF EXISTS ideas_pod_id_fkey;
ALTER TABLE IF EXISTS predictions DROP CONSTRAINT IF EXISTS predictions_pod_id_fkey;

-- Drop pod_id column from reasoning entities
ALTER TABLE IF EXISTS problems DROP COLUMN IF EXISTS pod_id;
ALTER TABLE IF EXISTS ideas DROP COLUMN IF EXISTS pod_id;
ALTER TABLE IF EXISTS predictions DROP COLUMN IF EXISTS pod_id;

-- Add simple RLS policies for reasoning entity tables
CREATE POLICY "Anyone can read problems"
  ON problems FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read ideas"
  ON ideas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Anyone can read predictions"
  ON predictions FOR SELECT
  TO authenticated
  USING (true);

-- Also allow anon to read for public/guest access
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'problems' AND policyname = 'Anon can read problems') THEN
    EXECUTE 'CREATE POLICY "Anon can read problems" ON problems FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'ideas' AND policyname = 'Anon can read ideas') THEN
    EXECUTE 'CREATE POLICY "Anon can read ideas" ON ideas FOR SELECT TO anon USING (true)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'predictions' AND policyname = 'Anon can read predictions') THEN
    EXECUTE 'CREATE POLICY "Anon can read predictions" ON predictions FOR SELECT TO anon USING (true)';
  END IF;
END $$;

-- Drop FK from post_ai_insights to pods
ALTER TABLE IF EXISTS post_ai_insights DROP CONSTRAINT IF EXISTS post_ai_insights_related_pod_id_fkey;

-- Drop tables that reference decision_threads
DROP TABLE IF EXISTS ai_thread_recommendations CASCADE;
DROP TABLE IF EXISTS decision_paths CASCADE;
DROP TABLE IF EXISTS decision_path_pros CASCADE;
DROP TABLE IF EXISTS decision_path_cons CASCADE;
DROP TABLE IF EXISTS decision_thread_invites CASCADE;
DROP TABLE IF EXISTS decision_thread_links CASCADE;
DROP TABLE IF EXISTS decision_thread_members CASCADE;
DROP TABLE IF EXISTS decision_thread_tags CASCADE;
DROP TABLE IF EXISTS decision_thread_updates CASCADE;
DROP TABLE IF EXISTS decision_thread_votes CASCADE;
DROP TABLE IF EXISTS thread_view_sessions CASCADE;

-- Drop tables that reference pod_assumptions
DROP TABLE IF EXISTS agent_consensus CASCADE;
DROP TABLE IF EXISTS agent_conversation_memory CASCADE;
DROP TABLE IF EXISTS agent_conversations CASCADE;
DROP TABLE IF EXISTS agent_decision_memory CASCADE;
DROP TABLE IF EXISTS agent_decision_runs CASCADE;
DROP TABLE IF EXISTS agent_response_scores CASCADE;
DROP TABLE IF EXISTS agent_responses CASCADE;
DROP TABLE IF EXISTS ai_resolution_requests CASCADE;
DROP TABLE IF EXISTS assumption_challenges CASCADE;
DROP TABLE IF EXISTS assumption_forecasts CASCADE;
DROP TABLE IF EXISTS assumption_mentions CASCADE;
DROP TABLE IF EXISTS assumption_outcomes CASCADE;
DROP TABLE IF EXISTS assumption_prediction_scores CASCADE;
DROP TABLE IF EXISTS assumption_reasoning CASCADE;
DROP TABLE IF EXISTS assumption_risks CASCADE;
DROP TABLE IF EXISTS assumption_scenarios CASCADE;
DROP TABLE IF EXISTS assumption_view_sessions CASCADE;
DROP TABLE IF EXISTS assumption_votes CASCADE;
DROP TABLE IF EXISTS challenge_ai_replies CASCADE;
DROP TABLE IF EXISTS decision_autopsy CASCADE;
DROP TABLE IF EXISTS pod_evidence CASCADE;
DROP TABLE IF EXISTS pod_evidence_votes CASCADE;
DROP TABLE IF EXISTS user_assumption_context CASCADE;

-- Drop tables that reference pods
DROP TABLE IF EXISTS decision_sessions CASCADE;
DROP TABLE IF EXISTS decision_session_members CASCADE;
DROP TABLE IF EXISTS decision_session_contributions CASCADE;
DROP TABLE IF EXISTS decision_threads CASCADE;
DROP TABLE IF EXISTS pod_assumptions CASCADE;
DROP TABLE IF EXISTS pod_forecasts CASCADE;
DROP TABLE IF EXISTS pod_members CASCADE;
DROP TABLE IF EXISTS pod_options CASCADE;
DROP TABLE IF EXISTS pod_risks CASCADE;
DROP TABLE IF EXISTS post_tags CASCADE;
DROP TABLE IF EXISTS post_ai_insights CASCADE;
DROP TABLE IF EXISTS insights CASCADE;
DROP TABLE IF EXISTS insight_likes CASCADE;

-- Drop the pods table itself
DROP TABLE IF EXISTS pods CASCADE;

-- Drop insight score tables
DROP TABLE IF EXISTS insight_events CASCADE;
DROP TABLE IF EXISTS user_reputation CASCADE;

-- Drop related functions
DROP FUNCTION IF EXISTS insert_pod_assumption CASCADE;
DROP FUNCTION IF EXISTS check_pod_membership CASCADE;
DROP FUNCTION IF EXISTS update_insight_score CASCADE;
DROP FUNCTION IF EXISTS calculate_insight_score CASCADE;
