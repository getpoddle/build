
-- Persistent log of every workspace ever created.
-- Rows are NEVER deleted even when the workspace is removed, so admins
-- can see the true lifetime workspace-creation count for each user.
CREATE TABLE workspace_creation_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL,   -- original workspace id (may no longer exist)
  owner_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  workspace_name text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_wcl_owner_id ON workspace_creation_log(owner_id);

ALTER TABLE workspace_creation_log ENABLE ROW LEVEL SECURITY;

-- Admins read via SECURITY DEFINER RPCs; regular users have no direct access.
CREATE POLICY "No direct user access" ON workspace_creation_log
  FOR ALL TO authenticated USING (false) WITH CHECK (false);

-- Trigger function: log every new workspace immediately after INSERT
CREATE OR REPLACE FUNCTION log_workspace_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO workspace_creation_log(workspace_id, owner_id, workspace_name, created_at)
  VALUES (NEW.id, NEW.owner_id, NEW.name, NEW.created_at);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_workspace_creation
  AFTER INSERT ON workspaces
  FOR EACH ROW EXECUTE FUNCTION log_workspace_creation();

-- Backfill: record all workspaces that already exist
INSERT INTO workspace_creation_log(workspace_id, owner_id, workspace_name, created_at)
SELECT id, owner_id, name, created_at
FROM workspaces
ON CONFLICT DO NOTHING;
