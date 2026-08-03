/*
  # Domain Management System

  ## Overview
  Adds a domain management system for administrators to control:
  1. Allowed email domains for user registration (whitelist)
  2. Allowed admin email addresses (replaces hardcoded list)
  3. Email sending configuration (from-name, reply-to domain)

  ## New Tables

  ### `allowed_domains`
  - Stores whitelisted email domains for registration
  - `domain` (text, unique) - e.g. "example.com"
  - `type` (text) - 'registration' | 'admin' | 'both'
  - `is_active` (boolean) - whether the rule is enforced
  - `notes` (text) - admin notes about why this domain was added
  - `created_by` (uuid) - which admin added it
  - `created_at`, `updated_at` timestamps

  ### `admin_email_list`
  - Database-driven replacement for hardcoded admin email list
  - `email` (text, unique) - full email address
  - `label` (text) - friendly label for this entry
  - `is_active` (boolean)
  - `created_by` (uuid)
  - `created_at` timestamp

  ### `email_sending_config`
  - Key-value store for email sending configuration
  - `key` (text, unique) - config key
  - `value` (text) - config value
  - `description` (text) - human-readable description
  - `updated_by` (uuid)
  - `updated_at` timestamp

  ## Security
  - RLS enabled on all tables
  - Only admins can read or write to these tables
*/

-- Allowed email domains table
CREATE TABLE IF NOT EXISTS allowed_domains (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain text UNIQUE NOT NULL,
  type text NOT NULL DEFAULT 'registration' CHECK (type IN ('registration', 'admin', 'both')),
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE allowed_domains ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select allowed_domains"
  ON allowed_domains FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can insert allowed_domains"
  ON allowed_domains FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can update allowed_domains"
  ON allowed_domains FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can delete allowed_domains"
  ON allowed_domains FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admin email list table (replaces hardcoded list in Admin.tsx)
CREATE TABLE IF NOT EXISTS admin_email_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  label text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_email_list ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select admin_email_list"
  ON admin_email_list FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can insert admin_email_list"
  ON admin_email_list FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can update admin_email_list"
  ON admin_email_list FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can delete admin_email_list"
  ON admin_email_list FOR DELETE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Email sending configuration table
CREATE TABLE IF NOT EXISTS email_sending_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  description text DEFAULT '',
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE email_sending_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can select email_sending_config"
  ON email_sending_config FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can insert email_sending_config"
  ON email_sending_config FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

CREATE POLICY "Admins can update email_sending_config"
  ON email_sending_config FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Seed default email sending config keys
INSERT INTO email_sending_config (key, value, description)
VALUES
  ('from_name', 'Poddle', 'Display name used in outgoing emails'),
  ('from_domain', 'poddle.app', 'Domain used for the From address in outgoing emails'),
  ('reply_to', '', 'Reply-to email address (leave blank to use from address)'),
  ('support_email', 'support@poddle.app', 'Support email shown to users')
ON CONFLICT (key) DO NOTHING;

-- Seed existing hardcoded admin emails into the new table
INSERT INTO admin_email_list (email, label, is_active)
VALUES
  ('akinbobolaoludotun@gmail.com', 'Primary Admin', true),
  ('oludotunakinbobola@gmail.com', 'Secondary Admin', true)
ON CONFLICT (email) DO NOTHING;

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_allowed_domains_domain ON allowed_domains(domain);
CREATE INDEX IF NOT EXISTS idx_allowed_domains_type ON allowed_domains(type);
CREATE INDEX IF NOT EXISTS idx_admin_email_list_email ON admin_email_list(email);
CREATE INDEX IF NOT EXISTS idx_email_sending_config_key ON email_sending_config(key);
