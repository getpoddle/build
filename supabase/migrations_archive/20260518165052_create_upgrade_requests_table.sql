/*
  # Create upgrade_requests table

  Tracks when users request to upgrade their subscription plan.

  1. New Tables
    - `upgrade_requests`
      - `id` (uuid, primary key)
      - `user_id` (uuid, FK → profiles)
      - `requested_plan` (text): 'pro' | 'enterprise'
      - `status` (text): 'pending' | 'approved' | 'rejected' | 'converted'
      - `notes` (text, nullable): user-provided context
      - `admin_notes` (text, nullable): admin review notes
      - `reviewed_by` (uuid, nullable): admin who actioned it
      - `reviewed_at` (timestamptz, nullable)
      - `created_at` (timestamptz)

  2. Security
    - RLS enabled
    - Authenticated users can insert their own requests
    - Admins can read and update all requests (via service role)
    - Users can read their own requests
*/

CREATE TABLE IF NOT EXISTS upgrade_requests (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  requested_plan text NOT NULL DEFAULT 'pro' CHECK (requested_plan IN ('pro', 'enterprise')),
  status         text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'converted')),
  notes          text,
  admin_notes    text,
  reviewed_by    uuid REFERENCES profiles(id) ON DELETE SET NULL,
  reviewed_at    timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_upgrade_requests_user_id   ON upgrade_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_status    ON upgrade_requests(status);
CREATE INDEX IF NOT EXISTS idx_upgrade_requests_created   ON upgrade_requests(created_at DESC);

ALTER TABLE upgrade_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own upgrade requests"
  ON upgrade_requests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view own upgrade requests"
  ON upgrade_requests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
