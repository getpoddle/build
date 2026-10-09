/*
# Fix: Revoke PUBLIC EXECUTE on new versioning/snapshot functions

PostgreSQL functions default to PUBLIC EXECUTE. The previous migration
used REVOKE FROM PUBLIC but the grant still shows as =X/postgres.
This migration re-applies the revokes correctly.
*/

REVOKE EXECUTE ON FUNCTION public.revise_evidence_claim(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_evidence_claim(uuid, text, text, text, text) TO authenticated, service_role;

REVOKE EXECUTE ON FUNCTION public.create_decision_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_decision_snapshot(uuid) TO authenticated, service_role;
