/*
  # Fix admin_delete_challenge and ensure comment update works

  ## Changes
  1. Fix admin_delete_challenge to delete from assumption_challenges instead of challenges table
  2. Ensure post_comments updated_at is refreshed on update via trigger
  3. Add missing UPDATE policy for assumption_challenges (authors can update their own)

  ## Reason
  - admin_delete_challenge was deleting from the wrong table (challenges vs assumption_challenges)
  - post_comments needs updated_at kept current so edits are visible
*/

-- Fix admin_delete_challenge to target assumption_challenges table
CREATE OR REPLACE FUNCTION admin_delete_challenge(challenge_id_param uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  DELETE FROM assumption_challenges WHERE id = challenge_id_param;
END;
$$;

-- Ensure post_comments updated_at is auto-updated on edit
CREATE OR REPLACE FUNCTION update_post_comments_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_post_comments_updated_at ON post_comments;
CREATE TRIGGER set_post_comments_updated_at
  BEFORE UPDATE ON post_comments
  FOR EACH ROW
  EXECUTE FUNCTION update_post_comments_updated_at();

-- Add UPDATE policy for assumption_challenges (missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'assumption_challenges' AND cmd = 'UPDATE'
  ) THEN
    CREATE POLICY "Authors can update their challenges"
      ON assumption_challenges
      FOR UPDATE
      TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
  END IF;
END $$;
