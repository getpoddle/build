/*
  # Fix Multiple Permissive RLS Policies

  This migration consolidates multiple permissive policies into single, clear policies
  to eliminate security risks from overlapping access rules.

  1. Changes to `user_challenges`
    - Drop existing SELECT policies: "Users can manage own challenges" and "Users can view all challenges"
    - Create single SELECT policy: "Authenticated users can view all challenges"
    - Keep existing policies for INSERT/UPDATE/DELETE

  2. Changes to `user_interests`
    - Drop existing SELECT policies: "Users can manage own interests" and "Users can view all interests"
    - Create single SELECT policy: "Authenticated users can view all interests"
    - Keep existing policies for INSERT/UPDATE/DELETE

  3. Changes to `user_skills`
    - Drop existing SELECT policies: "Users can manage own skills" and "Users can view all skills"
    - Create single SELECT policy: "Authenticated users can view all skills"
    - Keep existing policies for INSERT/UPDATE/DELETE

  ## Security Notes
  - Consolidated policies reduce complexity and potential security holes
  - Users can view all records but can only modify their own
  - All policies require authentication
*/

-- Fix user_challenges policies
DO $$ 
BEGIN
  -- Drop existing SELECT policies if they exist
  DROP POLICY IF EXISTS "Users can manage own challenges" ON user_challenges;
  DROP POLICY IF EXISTS "Users can view all challenges" ON user_challenges;
  
  -- Create single consolidated SELECT policy
  CREATE POLICY "Authenticated users can view all challenges"
    ON user_challenges
    FOR SELECT
    TO authenticated
    USING (true);

  -- Ensure INSERT policy exists
  DROP POLICY IF EXISTS "Users can insert own challenges" ON user_challenges;
  CREATE POLICY "Users can insert own challenges"
    ON user_challenges
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Ensure UPDATE policy exists
  DROP POLICY IF EXISTS "Users can update own challenges" ON user_challenges;
  CREATE POLICY "Users can update own challenges"
    ON user_challenges
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Ensure DELETE policy exists
  DROP POLICY IF EXISTS "Users can delete own challenges" ON user_challenges;
  CREATE POLICY "Users can delete own challenges"
    ON user_challenges
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Fix user_interests policies
DO $$ 
BEGIN
  -- Drop existing SELECT policies if they exist
  DROP POLICY IF EXISTS "Users can manage own interests" ON user_interests;
  DROP POLICY IF EXISTS "Users can view all interests" ON user_interests;
  
  -- Create single consolidated SELECT policy
  CREATE POLICY "Authenticated users can view all interests"
    ON user_interests
    FOR SELECT
    TO authenticated
    USING (true);

  -- Ensure INSERT policy exists
  DROP POLICY IF EXISTS "Users can insert own interests" ON user_interests;
  CREATE POLICY "Users can insert own interests"
    ON user_interests
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Ensure UPDATE policy exists
  DROP POLICY IF EXISTS "Users can update own interests" ON user_interests;
  CREATE POLICY "Users can update own interests"
    ON user_interests
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Ensure DELETE policy exists
  DROP POLICY IF EXISTS "Users can delete own interests" ON user_interests;
  CREATE POLICY "Users can delete own interests"
    ON user_interests
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
END $$;

-- Fix user_skills policies
DO $$ 
BEGIN
  -- Drop existing SELECT policies if they exist
  DROP POLICY IF EXISTS "Users can manage own skills" ON user_skills;
  DROP POLICY IF EXISTS "Users can view all skills" ON user_skills;
  
  -- Create single consolidated SELECT policy
  CREATE POLICY "Authenticated users can view all skills"
    ON user_skills
    FOR SELECT
    TO authenticated
    USING (true);

  -- Ensure INSERT policy exists
  DROP POLICY IF EXISTS "Users can insert own skills" ON user_skills;
  CREATE POLICY "Users can insert own skills"
    ON user_skills
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

  -- Ensure UPDATE policy exists
  DROP POLICY IF EXISTS "Users can update own skills" ON user_skills;
  CREATE POLICY "Users can update own skills"
    ON user_skills
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

  -- Ensure DELETE policy exists
  DROP POLICY IF EXISTS "Users can delete own skills" ON user_skills;
  CREATE POLICY "Users can delete own skills"
    ON user_skills
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);
END $$;