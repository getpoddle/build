/*
# Invite Codes and Beta Access Grants

## Summary
Adds an invite-code-based beta access system to Poddle. Admins can generate
invite codes and distribute them to beta users. When a user redeems a code,
they receive 60 days of beta access that unlocks the same features as a paid
subscription (War Room, Pattern Intelligence, etc.).

## New Tables

### invite_codes
Stores invite codes that admins create and distribute.
- `id` (uuid, primary key)
- `code` (text, unique, uppercase alphanumeric) — the code users enter
- `max_uses` (int, default 1) — how many times the code can be redeemed
- `use_count` (int, default 0) — how many times it has been redeemed
- `expires_at` (timestamptz, nullable) — optional hard expiry for the code itself
- `notes` (text, nullable) — admin notes (e.g. "batch for ProductHunt launch")
- `created_by` (uuid, nullable) — references auth.users; which admin created it
- `created_at` (timestamptz, default now())

### beta_access_grants
Records each user's beta access grant when they redeem an invite code.
- `id` (uuid, primary key)
- `user_id` (uuid, unique, references auth.users) — one active grant per user
- `invite_code_id` (uuid, references invite_codes) — which code was redeemed
- `granted_at` (timestamptz, default now())
- `expires_at` (timestamptz) — granted_at + 60 days, set by the edge function
- `status` (text, default 'active') — 'active' | 'expired' | 'converted_to_paid'

## Security (RLS)

### invite_codes
- Admins (rows in the `admins` table) can SELECT, INSERT, UPDATE.
- No public read/write — codes are managed only via edge functions (service role) or admin panel.

### beta_access_grants
- Users can SELECT their own row (read beta access status client-side).
- No INSERT/UPDATE/DELETE from the client — the `redeem-invite-code` edge function
  uses the service role key to write grants and increment use_count.
*/

-- ── invite_codes ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS invite_codes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code         text UNIQUE NOT NULL,
  max_uses     integer NOT NULL DEFAULT 1,
  use_count    integer NOT NULL DEFAULT 0,
  expires_at   timestamptz,
  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS invite_codes_code_idx ON invite_codes (LOWER(code));

ALTER TABLE invite_codes ENABLE ROW LEVEL SECURITY;

-- Admins can read all codes
DROP POLICY IF EXISTS "admins_select_invite_codes" ON invite_codes;
CREATE POLICY "admins_select_invite_codes" ON invite_codes FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admins can insert codes
DROP POLICY IF EXISTS "admins_insert_invite_codes" ON invite_codes;
CREATE POLICY "admins_insert_invite_codes" ON invite_codes FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- Admins can update codes
DROP POLICY IF EXISTS "admins_update_invite_codes" ON invite_codes;
CREATE POLICY "admins_update_invite_codes" ON invite_codes FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));

-- ── beta_access_grants ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS beta_access_grants (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invite_code_id uuid NOT NULL REFERENCES invite_codes(id) ON DELETE RESTRICT,
  granted_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL,
  status         text NOT NULL DEFAULT 'active'
                 CHECK (status IN ('active', 'expired', 'converted_to_paid'))
);

CREATE INDEX IF NOT EXISTS beta_access_grants_user_id_idx ON beta_access_grants (user_id);
CREATE INDEX IF NOT EXISTS beta_access_grants_status_idx ON beta_access_grants (status);

ALTER TABLE beta_access_grants ENABLE ROW LEVEL SECURITY;

-- Users can read their own grant
DROP POLICY IF EXISTS "users_select_own_beta_grant" ON beta_access_grants;
CREATE POLICY "users_select_own_beta_grant" ON beta_access_grants FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can read all grants
DROP POLICY IF EXISTS "admins_select_beta_grants" ON beta_access_grants;
CREATE POLICY "admins_select_beta_grants" ON beta_access_grants FOR SELECT
  TO authenticated
  USING (EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()));
