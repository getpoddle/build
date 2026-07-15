/*
# Create email confirmation tokens table

## Purpose
Stores single-use tokens for the custom branded email confirmation flow.
When a user signs up, we create a token, send it via our branded Resend email,
and the user clicks a link that hits the confirm-email edge function to verify.

## New Tables
- `email_confirmation_tokens`
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users, cascade delete)
  - `token_hash` (text, unique — stores SHA-256 hash of the token, never the raw token)
  - `expires_at` (timestamptz, 24 hours from creation)
  - `confirmed_at` (timestamptz, nullable — set when user clicks the link)
  - `created_at` (timestamptz, default now())

## Security
- RLS enabled on the table.
- The table is only written to by the service role (edge functions), so policies
  are restrictive — no anon/authenticated access to tokens.
- An index on token_hash for fast lookups.
*/

CREATE TABLE IF NOT EXISTS email_confirmation_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text UNIQUE NOT NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_hash ON email_confirmation_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_email_confirmation_tokens_user ON email_confirmation_tokens(user_id);

ALTER TABLE email_confirmation_tokens ENABLE ROW LEVEL SECURITY;

-- No policies: this table is only accessed via the service role key in edge functions.
-- RLS is enabled so even if the anon key somehow reaches it, no rows are returned.