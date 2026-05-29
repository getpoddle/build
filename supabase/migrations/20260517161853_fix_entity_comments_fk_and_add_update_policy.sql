/*
  # Fix entity_comments: add FK to profiles, update policy, and AI insert policy

  ## Changes
  1. Add FK from entity_comments.user_id to public.profiles(id) so Supabase JS
     can perform the profiles join via select('*, profiles(...)').
  2. Add UPDATE policy so users can edit their own comments.
  3. Add INSERT policy for service role (AI corrections with null user_id).
*/

-- Drop the existing FK to auth.users and re-add pointing to profiles
ALTER TABLE entity_comments DROP CONSTRAINT IF EXISTS entity_comments_user_id_fkey;

ALTER TABLE entity_comments
  ADD CONSTRAINT entity_comments_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- Allow users to update their own comments (for edit feature)
CREATE POLICY "Users can update own comments"
  ON entity_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow service_role to insert AI corrections (user_id = null)
CREATE POLICY "Service role can insert AI corrections"
  ON entity_comments FOR INSERT
  TO service_role
  WITH CHECK (true);
