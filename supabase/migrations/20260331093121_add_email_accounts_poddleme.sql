/*
  # Email Accounts - poddleme.com

  ## Overview
  Adds a table for managing @poddleme.com email accounts that admins can create
  and manage from the admin panel.

  ## New Tables

  ### `email_accounts`
  - Stores @poddleme.com email accounts
  - `id` (uuid, primary key)
  - `username` (text, unique) - the part before @poddleme.com
  - `display_name` (text) - friendly name for this mailbox
  - `description` (text) - purpose / notes
  - `is_active` (boolean) - whether this account is active
  - `forward_to` (text) - optional forwarding address
  - `created_by` (uuid) - admin who created it
  - `created_at`, `updated_at` timestamps

  ## Security
  - RLS enabled
  - Only admins can read/write email accounts
*/

CREATE TABLE IF NOT EXISTS email_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  forward_to text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email accounts"
  ON email_accounts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can insert email accounts"
  ON email_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can update email accounts"
  ON email_accounts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete email accounts"
  ON email_accounts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins WHERE admins.id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_email_accounts_username ON email_accounts(username);
CREATE INDEX IF NOT EXISTS idx_email_accounts_is_active ON email_accounts(is_active);
