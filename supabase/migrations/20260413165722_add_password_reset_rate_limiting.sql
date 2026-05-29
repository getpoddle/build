/*
  # Add Password Reset Rate Limiting

  ## Purpose
  Tracks password reset attempts per IP address to prevent:
  - Email enumeration attacks
  - Reset email spam / flooding

  ## New Tables
  - `password_reset_attempts`
    - `id` (uuid, primary key)
    - `ip_address` (text) — the requester's IP
    - `attempted_at` (timestamptz) — when the attempt was made

  ## Security
  - RLS enabled, no direct client access (only service-role via edge function)
  - Attempts older than 1 hour are considered expired (handled in function logic)

  ## Notes
  - Max 5 attempts per IP per hour
  - Index on ip_address + attempted_at for fast lookups
*/

CREATE TABLE IF NOT EXISTS password_reset_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ip_address text NOT NULL,
  attempted_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE password_reset_attempts ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_password_reset_attempts_ip_time
  ON password_reset_attempts (ip_address, attempted_at DESC);
