/*
  # Fix RLS Auth Initialization Performance

  1. Changes
    - Update RLS policies to use (select auth.uid()) instead of auth.uid()
    - This prevents re-evaluation of auth function for each row
    - Significantly improves query performance at scale

  2. Tables Affected
    - decision_thread_members
    - decision_thread_updates
    - forecast_comments
    - risk_comments
    - scenario_comments
    - email_notification_queue

  3. Performance Impact
    - Reduces query execution time by caching auth.uid() result
    - Improves scalability for large datasets
*/

-- Fix decision_thread_members policies
DROP POLICY IF EXISTS "Pod members can view thread members" ON decision_thread_members;
CREATE POLICY "Pod members can view thread members"
  ON decision_thread_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pods p ON p.id = dt.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE dt.id = thread_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

-- Fix decision_thread_updates policies
DROP POLICY IF EXISTS "Pod members can view thread updates" ON decision_thread_updates;
CREATE POLICY "Pod members can view thread updates"
  ON decision_thread_updates FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pods p ON p.id = dt.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE dt.id = thread_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

-- Fix forecast_comments policies
DROP POLICY IF EXISTS "Users can view comments on accessible forecasts" ON forecast_comments;
CREATE POLICY "Users can view comments on accessible forecasts"
  ON forecast_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assumption_forecasts af
      JOIN pod_assumptions pa ON pa.id = af.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE af.id = forecast_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible forecasts" ON forecast_comments;
CREATE POLICY "Users can create comments on accessible forecasts"
  ON forecast_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM assumption_forecasts af
      JOIN pod_assumptions pa ON pa.id = af.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE af.id = forecast_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can update their own forecast comments" ON forecast_comments;
CREATE POLICY "Users can update their own forecast comments"
  ON forecast_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own forecast comments" ON forecast_comments;
CREATE POLICY "Users can delete their own forecast comments"
  ON forecast_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix risk_comments policies
DROP POLICY IF EXISTS "Users can view comments on accessible risks" ON risk_comments;
CREATE POLICY "Users can view comments on accessible risks"
  ON risk_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assumption_risks ar
      JOIN pod_assumptions pa ON pa.id = ar.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE ar.id = risk_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible risks" ON risk_comments;
CREATE POLICY "Users can create comments on accessible risks"
  ON risk_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM assumption_risks ar
      JOIN pod_assumptions pa ON pa.id = ar.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE ar.id = risk_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can update their own risk comments" ON risk_comments;
CREATE POLICY "Users can update their own risk comments"
  ON risk_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own risk comments" ON risk_comments;
CREATE POLICY "Users can delete their own risk comments"
  ON risk_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix scenario_comments policies
DROP POLICY IF EXISTS "Users can view comments on accessible scenarios" ON scenario_comments;
CREATE POLICY "Users can view comments on accessible scenarios"
  ON scenario_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assumption_scenarios ass
      JOIN pod_assumptions pa ON pa.id = ass.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE ass.id = scenario_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can create comments on accessible scenarios" ON scenario_comments;
CREATE POLICY "Users can create comments on accessible scenarios"
  ON scenario_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM assumption_scenarios ass
      JOIN pod_assumptions pa ON pa.id = ass.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE ass.id = scenario_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can update their own scenario comments" ON scenario_comments;
CREATE POLICY "Users can update their own scenario comments"
  ON scenario_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own scenario comments" ON scenario_comments;
CREATE POLICY "Users can delete their own scenario comments"
  ON scenario_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- Fix email_notification_queue policies
DROP POLICY IF EXISTS "Users can view their own queued emails" ON email_notification_queue;
CREATE POLICY "Users can view their own queued emails"
  ON email_notification_queue FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));
