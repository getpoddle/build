/*
  # Allow Public Access to All Insights

  This migration enables public viewing of all insights on the homepage.
  
  1. **Changes**
     - Drop the restrictive policy that only allows viewing insights from public pods
     - Create a new policy that allows everyone (anonymous and authenticated) to view all insights
     - Keep write operations restricted to authenticated users
  
  2. **Security**
     - Read access is public for discovery and engagement
     - Write, update, and delete operations remain protected
     - Users must be authenticated to create, modify, or delete insights
*/

-- Drop the old restrictive policy for anonymous users
DROP POLICY IF EXISTS "Public can view insights of shared pods" ON insights;

-- Create a new policy that allows everyone to view all insights
CREATE POLICY "Everyone can view all insights"
  ON insights
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Remove the old authenticated-only policy since we now have a combined one
DROP POLICY IF EXISTS "Authenticated users can view all insights" ON insights;