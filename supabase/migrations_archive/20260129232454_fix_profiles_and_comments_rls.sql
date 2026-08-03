/*
  # Fix Profiles and Comments RLS Policies

  ## Problem
  Users cannot see:
  - Profile information (author names/avatars) for insights
  - Comments on insights
  
  This is because the RLS policies are too restrictive.

  ## Changes
  1. **Profiles Table**
     - Allow all authenticated users to view all profiles (needed to see authors)
     - Keep user-only restriction for updating own profile
  
  2. **Comments Table**
     - Allow all authenticated users to view all comments (needed for discussions)
     - Keep authentication requirement for creating comments
     - Keep author requirement for deleting own comments

  ## Security
  - All policies still require authentication
  - Write operations still check ownership
  - Only read permissions are relaxed for discovery
*/

-- Fix profiles policies
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON profiles;

CREATE POLICY "Authenticated users can view all profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- Fix comments policies
DROP POLICY IF EXISTS "Authenticated users can view comments" ON comments;

CREATE POLICY "Authenticated users can view all comments"
  ON comments FOR SELECT
  TO authenticated
  USING (true);
