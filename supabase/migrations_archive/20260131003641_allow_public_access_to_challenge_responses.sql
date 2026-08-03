/*
  # Allow public access to challenge responses and related data

  1. Changes
    - Allow anonymous (unauthenticated) users to view challenge responses
    - Allow anonymous users to view challenges
    - This enables public viewing of challenge content without requiring login
    
  2. Security
    - Read-only access for anonymous users
    - Write operations still require authentication
*/

-- Drop existing restrictive policy for challenge_responses
DROP POLICY IF EXISTS "Anyone can view responses" ON challenge_responses;

-- Create new policy allowing both authenticated and anonymous users
CREATE POLICY "Public can view responses"
  ON challenge_responses FOR SELECT
  TO anon, authenticated
  USING (true);

-- Drop existing restrictive policy for challenges
DROP POLICY IF EXISTS "Anyone can view challenges" ON challenges;

-- Create new policy allowing both authenticated and anonymous users
CREATE POLICY "Public can view challenges"
  ON challenges FOR SELECT
  TO anon, authenticated
  USING (true);
