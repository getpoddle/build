/*
  # Fix Posts Public Read Access

  ## Summary
  The posts SELECT policy was restricted to `authenticated` role only, which means:
  - Unauthenticated (anon) visitors see no posts at all
  - The PostFeed shows an empty feed to logged-out users

  ## Changes
  1. Drop the existing SELECT policy on `posts` that only allows `authenticated`
  2. Create a new SELECT policy that allows BOTH `anon` and `authenticated` roles to read all posts

  This makes the home feed visible to all visitors, which is the intended behavior.
*/

DROP POLICY IF EXISTS "Users can read all posts" ON posts;

CREATE POLICY "Anyone can read all posts"
  ON posts
  FOR SELECT
  TO anon, authenticated
  USING (true);
