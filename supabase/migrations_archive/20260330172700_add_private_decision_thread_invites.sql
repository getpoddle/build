/*
  # Add Private Decision Thread Invites System

  1. Changes to decision_threads
    - Add `is_private` boolean column (default false)
    - Private threads are only visible to the creator and explicitly invited users

  2. New Tables
    - `decision_thread_invites`
      - `id` (uuid, primary key)
      - `thread_id` (uuid, FK → decision_threads)
      - `invited_user_id` (uuid, FK → profiles) — the user being invited
      - `invited_by` (uuid, FK → profiles) — the creator who sent the invite
      - `status` (text: 'pending' | 'accepted' | 'declined')
      - `created_at` (timestamptz)
      - UNIQUE(thread_id, invited_user_id)

  3. Security
    - RLS enabled on decision_thread_invites
    - Thread creators can manage invites for their threads
    - Invited users can read and update their own invite status
    - Private thread SELECT policy updated: visible to creator + accepted invitees + pod members (for public threads)
*/

-- Add is_private column to decision_threads
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'decision_threads' AND column_name = 'is_private'
  ) THEN
    ALTER TABLE decision_threads ADD COLUMN is_private boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- Create decision_thread_invites table
CREATE TABLE IF NOT EXISTS decision_thread_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid REFERENCES decision_threads(id) ON DELETE CASCADE NOT NULL,
  invited_user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  invited_by uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(thread_id, invited_user_id)
);

CREATE INDEX IF NOT EXISTS idx_decision_thread_invites_thread_id ON decision_thread_invites(thread_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_invites_invited_user_id ON decision_thread_invites(invited_user_id);
CREATE INDEX IF NOT EXISTS idx_decision_thread_invites_invited_by ON decision_thread_invites(invited_by);

ALTER TABLE decision_thread_invites ENABLE ROW LEVEL SECURITY;

-- Thread creator can view all invites for their threads
CREATE POLICY "Thread creator can view invites"
  ON decision_thread_invites FOR SELECT
  TO authenticated
  USING (
    invited_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM decision_threads dt
      WHERE dt.id = decision_thread_invites.thread_id
      AND dt.created_by = auth.uid()
    )
    OR
    invited_user_id = auth.uid()
  );

-- Thread creator can insert invites for their threads
CREATE POLICY "Thread creator can invite users"
  ON decision_thread_invites FOR INSERT
  TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND
    EXISTS (
      SELECT 1 FROM decision_threads dt
      WHERE dt.id = decision_thread_invites.thread_id
      AND dt.created_by = auth.uid()
    )
  );

-- Invited users can update their own invite status
CREATE POLICY "Invited users can update their status"
  ON decision_thread_invites FOR UPDATE
  TO authenticated
  USING (invited_user_id = auth.uid())
  WITH CHECK (invited_user_id = auth.uid());

-- Thread creator can delete/revoke invites
CREATE POLICY "Thread creator can delete invites"
  ON decision_thread_invites FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM decision_threads dt
      WHERE dt.id = decision_thread_invites.thread_id
      AND dt.created_by = auth.uid()
    )
  );

-- Helper function: check if user has access to a decision thread
CREATE OR REPLACE FUNCTION user_has_thread_access(p_thread_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM decision_threads dt
    WHERE dt.id = p_thread_id
    AND (
      -- Creator always has access
      dt.created_by = p_user_id
      OR
      -- If not private, pod members have access
      (NOT dt.is_private AND EXISTS (
        SELECT 1 FROM pod_members pm
        WHERE pm.pod_id = dt.pod_id AND pm.user_id = p_user_id
      ))
      OR
      -- If private, only invited users with accepted status have access
      (dt.is_private AND EXISTS (
        SELECT 1 FROM decision_thread_invites dti
        WHERE dti.thread_id = dt.id
        AND dti.invited_user_id = p_user_id
        AND dti.status = 'accepted'
      ))
    )
  );
$$;
