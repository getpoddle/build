/*
  # Private Workspaces System — Tables

  Creates core workspace tables without self-referential RLS policies.
  RLS policies that reference workspace_members are added in a separate migration.

  ## New Tables
  1. workspaces — premium private spaces
  2. workspace_members — membership with roles (owner/admin/member)
  3. workspace_invites — invite-only token-based access
  4. workspace_entities — scopes AI entities to a workspace

  ## Profiles
  - Adds subscription_tier column (free/pro/enterprise)
*/

-- 1. Add subscription_tier to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'subscription_tier'
  ) THEN
    ALTER TABLE profiles ADD COLUMN subscription_tier text NOT NULL DEFAULT 'free'
      CHECK (subscription_tier IN ('free', 'pro', 'enterprise'));
  END IF;
END $$;

-- 2. workspaces table
CREATE TABLE IF NOT EXISTS workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  domain text DEFAULT 'general',
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_type text NOT NULL DEFAULT 'private' CHECK (workspace_type IN ('private', 'encrypted')),
  is_encrypted boolean NOT NULL DEFAULT true,
  plan text NOT NULL DEFAULT 'pro' CHECK (plan IN ('pro', 'enterprise')),
  subscription_status text NOT NULL DEFAULT 'trialing' CHECK (subscription_status IN ('active', 'trialing', 'cancelled', 'past_due', 'inactive')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_end timestamptz,
  seats integer NOT NULL DEFAULT 5,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspaces ENABLE ROW LEVEL SECURITY;

-- 3. workspace_members table
CREATE TABLE IF NOT EXISTS workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE workspace_members ENABLE ROW LEVEL SECURITY;

-- 4. workspace_invites table
CREATE TABLE IF NOT EXISTS workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  invited_email text NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  invited_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE workspace_invites ENABLE ROW LEVEL SECURITY;

-- 5. workspace_entities table
CREATE TABLE IF NOT EXISTS workspace_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  entity_type text NOT NULL CHECK (entity_type IN ('problem', 'idea', 'prediction')),
  entity_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, entity_type, entity_id)
);

ALTER TABLE workspace_entities ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_token ON workspace_invites(token);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_workspace_id ON workspace_invites(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_invites_email ON workspace_invites(invited_email);
CREATE INDEX IF NOT EXISTS idx_workspace_entities_workspace_id ON workspace_entities(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_entities_entity ON workspace_entities(entity_type, entity_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_workspace_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_workspace_updated_at ON workspaces;
CREATE TRIGGER set_workspace_updated_at
  BEFORE UPDATE ON workspaces
  FOR EACH ROW EXECUTE FUNCTION update_workspace_updated_at();

-- Helper: check membership
CREATE OR REPLACE FUNCTION is_workspace_member(p_workspace_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id AND user_id = p_user_id
  );
END;
$$;

-- Helper: get role
CREATE OR REPLACE FUNCTION get_workspace_role(p_workspace_id uuid, p_user_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT role INTO v_role FROM workspace_members
  WHERE workspace_id = p_workspace_id AND user_id = p_user_id;
  RETURN v_role;
END;
$$;
