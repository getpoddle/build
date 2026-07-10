-- Nonce-based OAuth state store for Slack OAuth flow.
-- Each row is created by slack-start-oauth and consumed exactly once
-- by slack-oauth-install. Rows older than 10 minutes are considered expired.

CREATE TABLE IF NOT EXISTS slack_oauth_states (
  nonce          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id        UUID NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at        TIMESTAMPTZ
);

-- Fast expiry look-up
CREATE INDEX IF NOT EXISTS idx_slack_oauth_states_created_at
  ON slack_oauth_states (created_at);

ALTER TABLE slack_oauth_states ENABLE ROW LEVEL SECURITY;

-- Only the service role (used by edge functions) can read/write these rows.
-- No authenticated-user policies: the install callback runs without a user JWT.
CREATE POLICY "service_role_only_slack_oauth_states" ON slack_oauth_states
  FOR ALL TO service_role USING (true) WITH CHECK (true);
