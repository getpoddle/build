
-- Admin RPC: all workspaces with owner profile info (for the Workspaces tab)
CREATE OR REPLACE FUNCTION get_admin_all_workspaces()
RETURNS TABLE(
  id                     uuid,
  name                   text,
  description            text,
  plan                   text,
  subscription_status    text,
  seats                  integer,
  created_at             timestamptz,
  stripe_customer_id     text,
  stripe_subscription_id text,
  current_period_end     timestamptz,
  owner_full_name        text,
  owner_email            text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    w.id,
    w.name,
    w.description,
    w.plan,
    w.subscription_status,
    w.seats,
    w.created_at,
    w.stripe_customer_id,
    w.stripe_subscription_id,
    w.current_period_end,
    p.full_name  AS owner_full_name,
    p.email      AS owner_email
  FROM workspaces w
  LEFT JOIN profiles p ON p.id = w.owner_id
  ORDER BY w.created_at DESC;
END;
$$;

-- Admin RPC: workspace memberships for a specific user (for the user detail modal)
CREATE OR REPLACE FUNCTION get_admin_user_workspaces(target_user_id uuid)
RETURNS TABLE(
  role                text,
  joined_at           timestamptz,
  workspace_id        uuid,
  workspace_name      text,
  workspace_description text,
  workspace_plan      text,
  workspace_status    text,
  workspace_created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM admins WHERE admins.id = auth.uid()) THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  RETURN QUERY
  SELECT
    wm.role,
    wm.joined_at,
    w.id          AS workspace_id,
    w.name        AS workspace_name,
    w.description AS workspace_description,
    w.plan        AS workspace_plan,
    w.subscription_status AS workspace_status,
    w.created_at  AS workspace_created_at
  FROM workspace_members wm
  JOIN workspaces w ON w.id = wm.workspace_id
  WHERE wm.user_id = target_user_id
  ORDER BY wm.joined_at DESC;
END;
$$;
