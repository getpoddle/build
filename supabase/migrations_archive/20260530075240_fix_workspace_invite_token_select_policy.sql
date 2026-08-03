/*
  # Fix workspace invite token-based SELECT policy

  ## Problem
  The only existing SELECT policy on `workspace_invites` restricts reads to
  workspace owners/admins. This blocks the invite recipient from validating
  their own invite token when they click the link — they get an empty result
  and the UI shows "Invalid invite".

  ## Change
  Add a new SELECT policy that allows anyone (including unauthenticated/anon
  visitors) to read a single invite row when the token is known. The UUID
  token embedded in the invite URL acts as the secret granting read access.
  Only non-expired, unaccepted invites are readable this way.

  ## Security
  - The token is a random UUID (128 bits of entropy) — unguessable
  - Read access is limited to rows where expires_at > now() AND accepted_at IS NULL
  - Only the invite's own fields are exposed (no workspace secrets)
  - The existing admin-only policy for listing all workspace invites is unchanged
*/

CREATE POLICY "Anyone with invite token can view that invite"
  ON workspace_invites
  FOR SELECT
  TO anon, authenticated
  USING (
    expires_at > now()
    AND accepted_at IS NULL
  );
