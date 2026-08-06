/*
# Create debug_logs table (temporary instrumentation)

## Purpose
Temporary debug logging table to investigate the tab-disappearing bug
without relying on Sentry dashboard access. Rows are written fire-and-forget
from the frontend and can be queried directly in the Supabase SQL editor.

## New Tables
- `debug_logs`
  - `id` (uuid, primary key, auto-generated)
  - `created_at` (timestamptz, defaults to now)
  - `user_id` (uuid, references auth.users, nullable — null for pre-auth events)
  - `workspace_id` (uuid, nullable — null for non-workspace events)
  - `event_type` (text, not null — e.g. 'tab_change', 'global_error', 'boundary_catch')
  - `payload` (jsonb, not null — structured event details)

## Security
- RLS enabled.
- Users can only insert and read their own rows (auth.uid() = user_id).
- A separate policy allows insert when user_id is null (pre-auth global errors)
  scoped to authenticated role so anonymous traffic cannot spam the table.

## Notes
1. This table is temporary debug instrumentation and should be dropped
   once the tab-disappearing bug is resolved.
2. All writes are fire-and-forget from the frontend — failures are swallowed.
3. The user_id column is nullable so global errors before sign-in can still
   be logged (those rows will have user_id = null and can be queried by admins).
*/

CREATE TABLE IF NOT EXISTS debug_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id uuid,
  event_type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE debug_logs ENABLE ROW LEVEL SECURITY;

-- Users can read their own debug logs
DROP POLICY IF EXISTS "select_own_debug_logs" ON debug_logs;
CREATE POLICY "select_own_debug_logs"
  ON debug_logs FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can insert their own debug logs
DROP POLICY IF EXISTS "insert_own_debug_logs" ON debug_logs;
CREATE POLICY "insert_own_debug_logs"
  ON debug_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Allow inserting debug logs with null user_id (pre-auth global errors)
-- scoped to authenticated so anon can't spam
DROP POLICY IF EXISTS "insert_anon_user_debug_logs" ON debug_logs;
CREATE POLICY "insert_anon_user_debug_logs"
  ON debug_logs FOR INSERT
  TO authenticated
  WITH CHECK (user_id IS NULL);

-- Index for querying by workspace
CREATE INDEX IF NOT EXISTS idx_debug_logs_workspace_id ON debug_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_debug_logs_created_at ON debug_logs(created_at DESC);
