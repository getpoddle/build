/*
  # Integrations System

  ## Overview
  Adds support for third-party integrations (LinkedIn, Microsoft Teams, etc.)
  that allow users to connect external services and sync content into Poddle.

  ## New Tables

  ### `user_integrations`
  Stores per-user integration connection state and credentials.
  - `id` — UUID primary key
  - `user_id` — FK to profiles
  - `provider` — e.g. 'linkedin', 'teams'
  - `status` — 'connected' | 'disconnected' | 'error'
  - `access_token_encrypted` — encrypted OAuth token (nullable)
  - `refresh_token_encrypted` — encrypted refresh token (nullable)
  - `token_expires_at` — token expiry timestamp
  - `webhook_url` — inbound webhook URL for push integrations
  - `webhook_secret` — HMAC secret for webhook verification
  - `config` — JSONB for provider-specific settings
  - `last_synced_at` — when data was last pulled
  - `connected_at` — when integration was first connected
  - `created_at`, `updated_at`

  ### `integration_events`
  Audit log of all integration activity (imports, exports, errors).
  - `id` — UUID primary key
  - `user_id` — FK to profiles
  - `integration_id` — FK to user_integrations
  - `event_type` — 'import', 'export', 'webhook', 'error', 'sync'
  - `provider` — e.g. 'linkedin', 'teams'
  - `status` — 'success' | 'failed' | 'pending'
  - `summary` — human-readable description
  - `payload` — JSONB raw event data
  - `error_message` — error detail if failed
  - `created_at`

  ### `integration_imports`
  Structured records created from integration imports.
  - `id` — UUID primary key
  - `user_id` — FK to profiles
  - `integration_id` — FK to user_integrations
  - `provider` — source provider
  - `content_type` — 'assumption', 'post', 'challenge', 'forecast'
  - `source_title` — title from source
  - `source_content` — raw content from source
  - `source_url` — original URL
  - `source_id` — external ID from provider
  - `mapped_to_id` — UUID of created Poddle content (nullable)
  - `mapped_to_type` — type of created content (nullable)
  - `pod_id` — target pod (nullable)
  - `status` — 'pending' | 'mapped' | 'dismissed'
  - `ai_suggestion` — JSONB AI-generated mapping suggestion
  - `created_at`

  ## Security
  - RLS enabled on all three tables
  - Users can only read/write their own integration data
  - No public access
*/

CREATE TABLE IF NOT EXISTS user_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'error')),
  access_token_encrypted text,
  refresh_token_encrypted text,
  token_expires_at timestamptz,
  webhook_url text,
  webhook_secret text,
  config jsonb DEFAULT '{}'::jsonb,
  last_synced_at timestamptz,
  connected_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (user_id, provider)
);

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integrations"
  ON user_integrations FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integrations"
  ON user_integrations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
  ON user_integrations FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
  ON user_integrations FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_integrations_user_id ON user_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_integrations_provider ON user_integrations(provider);


CREATE TABLE IF NOT EXISTS integration_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES user_integrations(id) ON DELETE SET NULL,
  event_type text NOT NULL CHECK (event_type IN ('import', 'export', 'webhook', 'error', 'sync')),
  provider text NOT NULL,
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failed', 'pending')),
  summary text,
  payload jsonb DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE integration_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integration events"
  ON integration_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration events"
  ON integration_events FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_integration_events_user_id ON integration_events(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_integration_id ON integration_events(integration_id);
CREATE INDEX IF NOT EXISTS idx_integration_events_created_at ON integration_events(created_at DESC);


CREATE TABLE IF NOT EXISTS integration_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  integration_id uuid REFERENCES user_integrations(id) ON DELETE SET NULL,
  provider text NOT NULL,
  content_type text NOT NULL CHECK (content_type IN ('assumption', 'post', 'challenge', 'forecast', 'risk', 'scenario')),
  source_title text,
  source_content text NOT NULL,
  source_url text,
  source_id text,
  mapped_to_id uuid,
  mapped_to_type text,
  pod_id uuid REFERENCES pods(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'mapped', 'dismissed')),
  ai_suggestion jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE integration_imports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own integration imports"
  ON integration_imports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own integration imports"
  ON integration_imports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integration imports"
  ON integration_imports FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_integration_imports_user_id ON integration_imports(user_id);
CREATE INDEX IF NOT EXISTS idx_integration_imports_status ON integration_imports(status);
CREATE INDEX IF NOT EXISTS idx_integration_imports_provider ON integration_imports(provider);
