/*
  # Fix Complex RLS Auth UID Patterns

  1. Performance Improvements
    - Replace bare auth.uid() with (select auth.uid()) for complex policies with joins
  
  2. Tables Fixed
    - content_reports, decision_thread_links, decision_thread_members
    - decision_thread_tags, decision_thread_updates, decision_thread_votes
    - decision_threads, forecast_comments, moderation_actions
    - profiles, risk_comments, scenario_comments, user_account_status
*/

-- content_reports
DROP POLICY IF EXISTS "Admins can update reports" ON public.content_reports;
CREATE POLICY "Admins can update reports"
  ON public.content_reports FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can view all reports" ON public.content_reports;
CREATE POLICY "Admins can view all reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Users can create reports" ON public.content_reports;
CREATE POLICY "Users can create reports"
  ON public.content_reports FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view their own reports" ON public.content_reports;
CREATE POLICY "Users can view their own reports"
  ON public.content_reports FOR SELECT
  TO authenticated
  USING (reporter_id = (select auth.uid()));

-- decision_thread_links
DROP POLICY IF EXISTS "Pod members can create links" ON public.decision_thread_links;
CREATE POLICY "Pod members can create links"
  ON public.decision_thread_links FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Pod members can view links" ON public.decision_thread_links;
CREATE POLICY "Pod members can view links"
  ON public.decision_thread_links FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_links.thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

-- decision_thread_members
DROP POLICY IF EXISTS "Pod members can add themselves to threads" ON public.decision_thread_members;
CREATE POLICY "Pod members can add themselves to threads"
  ON public.decision_thread_members FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own thread membership" ON public.decision_thread_members;
CREATE POLICY "Users can update their own thread membership"
  ON public.decision_thread_members FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- decision_thread_tags
DROP POLICY IF EXISTS "Pod members can create tags" ON public.decision_thread_tags;
CREATE POLICY "Pod members can create tags"
  ON public.decision_thread_tags FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Pod members can view tags" ON public.decision_thread_tags;
CREATE POLICY "Pod members can view tags"
  ON public.decision_thread_tags FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_tags.thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Thread creator can delete tags" ON public.decision_thread_tags;
CREATE POLICY "Thread creator can delete tags"
  ON public.decision_thread_tags FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      WHERE dt.id = thread_id
      AND dt.created_by = (select auth.uid())
    )
  );

-- decision_thread_updates
DROP POLICY IF EXISTS "Pod members can create thread updates" ON public.decision_thread_updates;
CREATE POLICY "Pod members can create thread updates"
  ON public.decision_thread_updates FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

-- decision_thread_votes
DROP POLICY IF EXISTS "Pod members can view votes" ON public.decision_thread_votes;
CREATE POLICY "Pod members can view votes"
  ON public.decision_thread_votes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = decision_thread_votes.thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Pod members can vote" ON public.decision_thread_votes;
CREATE POLICY "Pod members can vote"
  ON public.decision_thread_votes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      JOIN pod_members pm ON pm.pod_id = dt.pod_id
      WHERE dt.id = thread_id
      AND pm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update their own votes" ON public.decision_thread_votes;
CREATE POLICY "Users can update their own votes"
  ON public.decision_thread_votes FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- decision_threads
DROP POLICY IF EXISTS "Pod members can create decision threads" ON public.decision_threads;
CREATE POLICY "Pod members can create decision threads"
  ON public.decision_threads FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_id = decision_threads.pod_id
      AND user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Pod members can view decision threads" ON public.decision_threads;
CREATE POLICY "Pod members can view decision threads"
  ON public.decision_threads FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pod_members
      WHERE pod_id = decision_threads.pod_id
      AND user_id = (select auth.uid())
    ) OR
    EXISTS (
      SELECT 1 FROM pods
      WHERE id = decision_threads.pod_id
      AND is_public = true
    )
  );

DROP POLICY IF EXISTS "Thread creator can delete decision threads" ON public.decision_threads;
CREATE POLICY "Thread creator can delete decision threads"
  ON public.decision_threads FOR DELETE
  TO authenticated
  USING (created_by = (select auth.uid()));

DROP POLICY IF EXISTS "Thread creator can update decision threads" ON public.decision_threads;
CREATE POLICY "Thread creator can update decision threads"
  ON public.decision_threads FOR UPDATE
  TO authenticated
  USING (created_by = (select auth.uid()))
  WITH CHECK (created_by = (select auth.uid()));

-- forecast_comments
DROP POLICY IF EXISTS "Users can create comments on accessible forecasts" ON public.forecast_comments;
CREATE POLICY "Users can create comments on accessible forecasts"
  ON public.forecast_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM assumption_forecasts af
      JOIN pod_assumptions pa ON pa.id = af.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE af.id = forecast_comments.forecast_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own forecast comments" ON public.forecast_comments;
CREATE POLICY "Users can delete their own forecast comments"
  ON public.forecast_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own forecast comments" ON public.forecast_comments;
CREATE POLICY "Users can update their own forecast comments"
  ON public.forecast_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- moderation_actions
DROP POLICY IF EXISTS "Admins can insert moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can insert moderation actions"
  ON public.moderation_actions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can view all moderation actions" ON public.moderation_actions;
CREATE POLICY "Admins can view all moderation actions"
  ON public.moderation_actions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

-- profiles
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = (select auth.uid())
      AND p.is_admin = true
    )
  );

-- risk_comments
DROP POLICY IF EXISTS "Users can create comments on accessible risks" ON public.risk_comments;
CREATE POLICY "Users can create comments on accessible risks"
  ON public.risk_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM assumption_risks ar
      JOIN pod_assumptions pa ON pa.id = ar.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE ar.id = risk_comments.risk_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own risk comments" ON public.risk_comments;
CREATE POLICY "Users can delete their own risk comments"
  ON public.risk_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own risk comments" ON public.risk_comments;
CREATE POLICY "Users can update their own risk comments"
  ON public.risk_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- scenario_comments
DROP POLICY IF EXISTS "Users can create comments on accessible scenarios" ON public.scenario_comments;
CREATE POLICY "Users can create comments on accessible scenarios"
  ON public.scenario_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM assumption_scenarios asco
      JOIN pod_assumptions pa ON pa.id = asco.assumption_id
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE asco.id = scenario_comments.scenario_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );

DROP POLICY IF EXISTS "Users can delete their own scenario comments" ON public.scenario_comments;
CREATE POLICY "Users can delete their own scenario comments"
  ON public.scenario_comments FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their own scenario comments" ON public.scenario_comments;
CREATE POLICY "Users can update their own scenario comments"
  ON public.scenario_comments FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- user_account_status
DROP POLICY IF EXISTS "Admins can insert account statuses" ON public.user_account_status;
CREATE POLICY "Admins can insert account statuses"
  ON public.user_account_status FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can update account statuses" ON public.user_account_status;
CREATE POLICY "Admins can update account statuses"
  ON public.user_account_status FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

DROP POLICY IF EXISTS "Admins can view all account statuses" ON public.user_account_status;
CREATE POLICY "Admins can view all account statuses"
  ON public.user_account_status FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND is_admin = true
    )
  );

-- assumption_mentions (fix the complex INSERT policy)
DROP POLICY IF EXISTS "Users can create mentions in accessible assumptions" ON public.assumption_mentions;
CREATE POLICY "Users can create mentions in accessible assumptions"
  ON public.assumption_mentions FOR INSERT
  TO authenticated
  WITH CHECK (
    mentioned_by_user_id = (select auth.uid()) AND
    EXISTS (
      SELECT 1 FROM pod_assumptions pa
      JOIN pods p ON p.id = pa.pod_id
      LEFT JOIN pod_members pm ON pm.pod_id = p.id AND pm.user_id = (select auth.uid())
      WHERE pa.id = assumption_mentions.assumption_id
      AND (p.is_public = true OR pm.user_id IS NOT NULL)
    )
  );
