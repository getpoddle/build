/*
  # Add PDF Exports Tracking and Workspace Usage Stats

  ## Summary
  Adds tracking for PDF exports per user, and an admin RPC to aggregate workspace
  usage metrics (workspaces created, workspaces opened as a member, PDFs exported)
  per user for the admin dashboard.

  ## New Tables
  - `pdf_exports`: Records each PDF export event with user_id, workspace context,
    and export type (chat / war_room / board_brief).

  ## New Functions
  - `get_all_users_workspace_pdf_stats()`: Admin RPC returning per-user counts for
    workspaces_created, workspaces_opened, and pdfs_exported.

  ## Security
  - RLS enabled on `pdf_exports`
  - Users can insert and read their own export rows only
  - The admin RPC uses SECURITY DEFINER so admins can aggregate across all users
*/

CREATE TABLE IF NOT EXISTS pdf_exports (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_id  uuid        REFERENCES workspaces(id) ON DELETE SET NULL,
  export_type   text        NOT NULL DEFAULT 'war_room',
  workspace_name text,
  exported_at   timestamptz DEFAULT now()
);

ALTER TABLE pdf_exports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own pdf exports"
  ON pdf_exports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own pdf exports"
  ON pdf_exports FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_pdf_exports_user_id ON pdf_exports(user_id);

CREATE OR REPLACE FUNCTION get_all_users_workspace_pdf_stats()
RETURNS TABLE(
  user_id            uuid,
  workspaces_created bigint,
  workspaces_opened  bigint,
  pdfs_exported      bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE((SELECT COUNT(*) FROM workspaces       w  WHERE w.owner_id  = p.id), 0) AS workspaces_created,
    COALESCE((SELECT COUNT(*) FROM workspace_members wm WHERE wm.user_id  = p.id), 0) AS workspaces_opened,
    COALESCE((SELECT COUNT(*) FROM pdf_exports      pe WHERE pe.user_id   = p.id), 0) AS pdfs_exported
  FROM profiles p;
$$;
