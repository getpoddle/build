/*
# Fix: Explicitly revoke EXECUTE from anon role on versioning functions

The =X (PUBLIC) entry was removed, but anon=X still exists as an
explicit grant. We must revoke from anon directly.
*/

REVOKE EXECUTE ON FUNCTION public.revise_evidence_claim(uuid, text, text, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_decision_snapshot(uuid) FROM anon;
