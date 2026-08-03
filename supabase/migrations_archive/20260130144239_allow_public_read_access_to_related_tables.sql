/*
  # Allow Public Read Access to Related Tables

  This migration enables public viewing of profiles, pods, comments, and likes
  so that anonymous users can see complete insight information on the homepage.
  
  1. **Changes**
     - Allow anonymous users to view all profiles
     - Allow anonymous users to view all pods
     - Allow anonymous users to view all comments
     - Allow anonymous users to view all likes
  
  2. **Security**
     - Only SELECT operations are allowed for anonymous users
     - Write operations remain restricted to authenticated users
     - Users cannot modify data they don't own
*/

-- Drop old restrictive policies
DROP POLICY IF EXISTS "Public can view profiles of shared pod members" ON profiles;
DROP POLICY IF EXISTS "Public can view shared pods" ON pods;
DROP POLICY IF EXISTS "Public can view comments of shared pods" ON comments;

-- Create new public read policies for profiles
CREATE POLICY "Everyone can view all profiles"
  ON profiles
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Remove old authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON profiles;

-- Create new public read policies for pods
CREATE POLICY "Everyone can view all pods"
  ON pods
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Remove old authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can view all pods" ON pods;

-- Create new public read policies for comments
CREATE POLICY "Everyone can view all comments"
  ON comments
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Remove old authenticated-only policy
DROP POLICY IF EXISTS "Authenticated users can view all comments" ON comments;

-- Allow anonymous users to view likes
CREATE POLICY "Everyone can view all insight likes"
  ON insight_likes
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- Remove old authenticated-only policy
DROP POLICY IF EXISTS "Anyone can view likes" ON insight_likes;

-- Check if 'likes' table exists and update it too
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'likes') THEN
    -- Drop old policy if exists
    DROP POLICY IF EXISTS "Authenticated users can view all likes" ON likes;
    
    -- Create new public read policy
    CREATE POLICY "Everyone can view all likes"
      ON likes
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;