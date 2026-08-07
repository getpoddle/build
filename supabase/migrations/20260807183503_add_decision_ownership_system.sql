/*
# Decision Ownership System

## Purpose
Adds a "Decision Ownership" feature (Business/Enterprise tier only) that lets workspace
admins assign an Owner and Backup Owner to each decision domain. Visibility only — no
approval logic, no blocking. Also supports per-card owner overrides on the Decision Map.

## New Tables
- `domain_owners`
  - `id` (uuid PK)
  - `workspace_id` (uuid FK → workspaces, cascade delete)
  - `domain` (text NOT NULL) — human-readable domain name, e.g. "Finance"
  - `category_key` (text NOT NULL) — maps to workspaces.decision_category keys
  - `owner_user_id` (uuid, nullable FK → auth.users, set null on delete)
  - `backup_owner_user_id` (uuid, nullable FK → auth.users, set null on delete)
  - `created_at` (timestamptz default now())
  - `updated_at` (timestamptz default now())
  - Unique constraint on (workspace_id, domain) so each domain appears once per workspace.

## Modified Tables
- `workspaces`
  - Adds `decision_owner_override_user_id` (uuid, nullable FK → auth.users, set null on delete).
    When set, the Decision Map card for this workspace shows this user as the owner instead
    of the domain default owner. NULL means "use domain default."

## Seed Data
- For every existing workspace, inserts 7 default domain_owners rows with category_key
  mapping to the existing decision_category values:
    Finance → financial, Marketing → other, Product → product, Legal → other,
    Operations → operational, People → people, Strategy → strategic
  Uses ON CONFLICT DO NOTHING so re-running is safe.

## Security (RLS)
- `domain_owners`: workspace-member-scoped CRUD. SELECT for any workspace member;
  INSERT/UPDATE/DELETE for workspace admins (owner or admin role) only.
  Membership is checked via EXISTS subquery on workspace_members.

## Notes
1. The feature is gated client-side by subscription_tier (Business/Enterprise). The RLS
   policies do NOT enforce tier — they only enforce workspace membership/admin role —
   because tier gating is the existing pattern in this app (see useSubscriptionTier).
2. category_key allows multiple domains to map to the same category. The unique constraint
   is on (workspace_id, domain) only. The Decision Map matches the FIRST domain_owners row
   for a given category_key.
3. No changes to synthesis, AI agents, or Decision Map status/columns.
*/

-- ─── domain_owners table ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS domain_owners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  domain text NOT NULL,
  category_key text NOT NULL,
  owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  backup_owner_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS domain_owners_workspace_domain_uidx
  ON domain_owners (workspace_id, domain);

CREATE INDEX IF NOT EXISTS domain_owners_workspace_category_idx
  ON domain_owners (workspace_id, category_key);

ALTER TABLE domain_owners ENABLE ROW LEVEL SECURITY;

-- SELECT: any workspace member can see domain owners
DROP POLICY IF EXISTS "select_domain_owners" ON domain_owners;
CREATE POLICY "select_domain_owners"
  ON domain_owners FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = domain_owners.workspace_id
        AND wm.user_id = auth.uid()
    )
  );

-- INSERT: workspace admins only
DROP POLICY IF EXISTS "insert_domain_owners" ON domain_owners;
CREATE POLICY "insert_domain_owners"
  ON domain_owners FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = domain_owners.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- UPDATE: workspace admins only
DROP POLICY IF EXISTS "update_domain_owners" ON domain_owners;
CREATE POLICY "update_domain_owners"
  ON domain_owners FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = domain_owners.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = domain_owners.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- DELETE: workspace admins only
DROP POLICY IF EXISTS "delete_domain_owners" ON domain_owners;
CREATE POLICY "delete_domain_owners"
  ON domain_owners FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM workspace_members wm
      WHERE wm.workspace_id = domain_owners.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- ─── workspaces.decision_owner_override_user_id ──────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'workspaces' AND column_name = 'decision_owner_override_user_id'
  ) THEN
    ALTER TABLE workspaces
      ADD COLUMN decision_owner_override_user_id uuid
      REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── Seed default domains for existing workspaces ─────────────────────────────
INSERT INTO domain_owners (workspace_id, domain, category_key)
SELECT w.id, d.domain, d.category_key
FROM workspaces w
CROSS JOIN (VALUES
  ('Finance', 'financial'),
  ('Marketing', 'other'),
  ('Product', 'product'),
  ('Legal', 'other'),
  ('Operations', 'operational'),
  ('People', 'people'),
  ('Strategy', 'strategic')
) AS d(domain, category_key)
WHERE NOT EXISTS (
  SELECT 1 FROM domain_owners dow
  WHERE dow.workspace_id = w.id AND dow.domain = d.domain
)
ON CONFLICT (workspace_id, domain) DO NOTHING;

-- ─── updated_at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_domain_owners_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS domain_owners_updated_at ON domain_owners;
CREATE TRIGGER domain_owners_updated_at
  BEFORE UPDATE ON domain_owners
  FOR EACH ROW
  EXECUTE FUNCTION touch_domain_owners_updated_at();
