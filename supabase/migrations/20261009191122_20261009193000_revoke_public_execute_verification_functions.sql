/*
# Fix: Revoke PUBLIC EXECUTE on verification functions

The previous migration used `REVOKE ... FROM anon`, but PostgreSQL
function EXECUTE defaults to PUBLIC. The `=X/postgres` ACL entry means
every role (including anon) can execute. We must REVOKE FROM PUBLIC
and then GRANT only to authenticated + service_role.
*/

-- Helper functions
REVOKE EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_decision_owner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_decision_owner(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.is_evidence_reviewer(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_evidence_reviewer(uuid, uuid) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.can_verify_evidence(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_verify_evidence(uuid, uuid) TO authenticated, service_role;

-- Verification functions
REVOKE EXECUTE ON FUNCTION public.reverify_decision_claim(uuid, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reverify_decision_claim(uuid, text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.request_reverification(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_reverification(uuid, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.update_evidence_classification(uuid, text, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_evidence_classification(uuid, text, text, text, text, text) TO authenticated, service_role;

-- Also ensure existing is_workspace_member and is_workspace_public
-- are not executable by anon (they currently have PUBLIC grant too)
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role, anon;
