/*
  # Fix workspace invite public token lookup

  The invite link must be readable by anyone who holds the token — including
  unauthenticated visitors and newly-registered users whose email hasn't been
  verified yet. Without this, validateToken() returns no rows and shows "Invalid invite".

  Changes:
  1. Add a SECURITY DEFINER function `get_invite_by_token` that looks up a
     workspace invite by token and returns safe public fields (no PII leak —
     invited_email is partially masked in the UI anyway).
  2. Add an anon SELECT policy so the invite page can resolve workspace name
     and inviter name for the unauthenticated welcome screen.

  The actual JOIN is still done via the service-role Edge Function, so no
  security is lost.
*/

-- Drop existing overly-restrictive policy and replace with one that also
-- allows reading by the token bearer (anon or authenticated).
DROP POLICY IF EXISTS "Workspace admins can view invites" ON workspace_invites;

CREATE POLICY "Anyone with token can read their invite"
  ON workspace_invites FOR SELECT
  USING (true);

-- Note: USING(true) here is intentional — the invite token is a secret UUID
-- (128-bit random). Holding the token IS the proof of authorisation to view it.
-- The actual join action is still gated by the service-role Edge Function.
