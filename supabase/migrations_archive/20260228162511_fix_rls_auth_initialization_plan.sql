/*
  # Fix RLS Auth Initialization Plan

  ## Summary
  Updates all RLS policies that call auth.uid() directly to use (select auth.uid())
  instead. This prevents re-evaluation of auth functions on every row, significantly
  improving query performance at scale.

  ## Tables affected
  - assumption_forecasts: delete, insert, update policies
  - assumption_risks: delete, insert policies
  - pod_assumptions: insert, delete, update policies
  - assumption_challenges: insert, delete policies
  - pod_options: insert, delete, update policies
  - pod_risks: insert, delete, update policies
  - pod_forecasts: delete, insert, update policies
*/

-- assumption_forecasts
DROP POLICY IF EXISTS "Users can delete own assumption forecasts" ON public.assumption_forecasts;
DROP POLICY IF EXISTS "Users can insert own assumption forecasts" ON public.assumption_forecasts;
DROP POLICY IF EXISTS "Users can update own assumption forecasts" ON public.assumption_forecasts;

CREATE POLICY "Users can delete own assumption forecasts"
  ON public.assumption_forecasts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert own assumption forecasts"
  ON public.assumption_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update own assumption forecasts"
  ON public.assumption_forecasts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- assumption_risks
DROP POLICY IF EXISTS "Users can delete own assumption risks" ON public.assumption_risks;
DROP POLICY IF EXISTS "Users can insert assumption risks" ON public.assumption_risks;

CREATE POLICY "Users can delete own assumption risks"
  ON public.assumption_risks FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Users can insert assumption risks"
  ON public.assumption_risks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

-- pod_assumptions
DROP POLICY IF EXISTS "Authenticated users can insert assumptions" ON public.pod_assumptions;
DROP POLICY IF EXISTS "Authors can delete their assumptions" ON public.pod_assumptions;
DROP POLICY IF EXISTS "Authors can update their assumptions" ON public.pod_assumptions;

CREATE POLICY "Authenticated users can insert assumptions"
  ON public.pod_assumptions FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Authors can delete their assumptions"
  ON public.pod_assumptions FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Authors can update their assumptions"
  ON public.pod_assumptions FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

-- assumption_challenges
DROP POLICY IF EXISTS "Authenticated users can insert challenges" ON public.assumption_challenges;
DROP POLICY IF EXISTS "Authors can delete their challenges" ON public.assumption_challenges;

CREATE POLICY "Authenticated users can insert challenges"
  ON public.assumption_challenges FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Authors can delete their challenges"
  ON public.assumption_challenges FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- pod_options
DROP POLICY IF EXISTS "Authenticated users can insert options" ON public.pod_options;
DROP POLICY IF EXISTS "Authors can delete their options" ON public.pod_options;
DROP POLICY IF EXISTS "Authors can update their options" ON public.pod_options;

CREATE POLICY "Authenticated users can insert options"
  ON public.pod_options FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Authors can delete their options"
  ON public.pod_options FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Authors can update their options"
  ON public.pod_options FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

-- pod_risks
DROP POLICY IF EXISTS "Authenticated users can insert risks" ON public.pod_risks;
DROP POLICY IF EXISTS "Authors can delete their risks" ON public.pod_risks;
DROP POLICY IF EXISTS "Authors can update their risks" ON public.pod_risks;

CREATE POLICY "Authenticated users can insert risks"
  ON public.pod_risks FOR INSERT
  TO authenticated
  WITH CHECK (created_by = (SELECT auth.uid()));

CREATE POLICY "Authors can delete their risks"
  ON public.pod_risks FOR DELETE
  TO authenticated
  USING (created_by = (SELECT auth.uid()));

CREATE POLICY "Authors can update their risks"
  ON public.pod_risks FOR UPDATE
  TO authenticated
  USING (created_by = (SELECT auth.uid()))
  WITH CHECK (created_by = (SELECT auth.uid()));

-- pod_forecasts
DROP POLICY IF EXISTS "Users can delete their own forecast" ON public.pod_forecasts;
DROP POLICY IF EXISTS "Users can insert their own forecast" ON public.pod_forecasts;
DROP POLICY IF EXISTS "Users can update their own forecast" ON public.pod_forecasts;

CREATE POLICY "Users can delete their own forecast"
  ON public.pod_forecasts FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can insert their own forecast"
  ON public.pod_forecasts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users can update their own forecast"
  ON public.pod_forecasts FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));
