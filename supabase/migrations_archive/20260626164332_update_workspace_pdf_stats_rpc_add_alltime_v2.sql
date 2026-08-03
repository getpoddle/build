
DROP FUNCTION IF EXISTS get_all_users_workspace_pdf_stats();

CREATE FUNCTION get_all_users_workspace_pdf_stats()
RETURNS TABLE(
  user_id                    uuid,
  workspaces_created         bigint,
  workspaces_opened          bigint,
  workspaces_created_alltime bigint,
  pdfs_exported              bigint
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id AS user_id,
    COALESCE((SELECT COUNT(*) FROM workspaces            w   WHERE w.owner_id   = p.id), 0) AS workspaces_created,
    COALESCE((SELECT COUNT(*) FROM workspace_members     wm  WHERE wm.user_id   = p.id), 0) AS workspaces_opened,
    COALESCE((SELECT COUNT(*) FROM workspace_creation_log wcl WHERE wcl.owner_id = p.id), 0) AS workspaces_created_alltime,
    COALESCE((SELECT COUNT(*) FROM pdf_exports           pe  WHERE pe.user_id    = p.id), 0) AS pdfs_exported
  FROM profiles p;
$$;
