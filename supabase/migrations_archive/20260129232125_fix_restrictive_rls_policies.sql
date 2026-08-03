/*
  # Fix Overly Restrictive RLS Policies

  ## Problem
  Current RLS policies prevent users from discovering content:
  - Users can only view pods they're already members of
  - Users can only view insights from pods they've joined
  - This creates a catch-22: can't see pods to join them

  ## Changes
  1. **Pods Table**
     - Allow all authenticated users to view all pods (needed for discovery)
     - Keep membership requirement for creating/updating pods
  
  2. **Insights Table**
     - Allow all authenticated users to view all insights (needed for feed)
     - Keep membership requirement for creating insights
     - Keep author requirement for updating/deleting own insights

  ## Security
  - All policies still require authentication
  - Write operations still check membership/ownership
  - Only read permissions are relaxed for discovery
*/

-- Drop overly restrictive policies
DROP POLICY IF EXISTS "Authenticated users can view pods" ON pods;
DROP POLICY IF EXISTS "Authenticated users can view insights" ON insights;

-- Allow all authenticated users to view all pods (for discovery)
CREATE POLICY "Authenticated users can view all pods"
  ON pods FOR SELECT
  TO authenticated
  USING (true);

-- Allow all authenticated users to view all insights (for feed)
CREATE POLICY "Authenticated users can view all insights"
  ON insights FOR SELECT
  TO authenticated
  USING (true);
