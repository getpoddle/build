/*
# Fix Missing EXECUTE Grants on RLS Helper Functions

## Summary
The enterprise security migration that revoked EXECUTE from all SECURITY DEFINER
functions over-revoked two critical helper functions that are called inside RLS
policies: `is_workspace_member` and `is_workspace_public`.

Without EXECUTE grants to `authenticated`, any RLS policy that calls these
functions fails with "permission denied for function is_workspace_member",
causing workspace data to be inaccessible (or in some contexts, exposing data
unintentionally if error handling falls through).

## Root Cause
Migration `20261009202138_enterprise_security_revoke_anon_execute_all_definer_functions.sql`
revoked EXECUTE from ALL SECURITY DEFINER functions from anon and PUBLIC.
Then it re-granted to authenticated only on functions explicitly listed.
`is_workspace_member` and `is_workspace_public` were not in the re-grant list,
but they ARE called by RLS policies on workspaces, workspace_members,
workspace_messages, workspace_synthesis, decision_claims, decision_events,
decision_snapshots, claim_verification_history, evidence_reviewers, and
evidence_versions.

## Fix
Grant EXECUTE on `is_workspace_member` and `is_workspace_public` to `authenticated`.
These functions take a workspace_id and check membership/public status — they do
not expose sensitive data and are required for RLS policy evaluation.

## Security
- These functions are SECURITY DEFINER with pinned search_path (public, pg_temp).
- They return boolean only — no data leakage.
- anon remains revoked (not re-granted) since anon users should not trigger
  workspace membership checks directly.
- This restores the intended RLS behavior where authenticated users can only
  access workspaces they belong to.
*/

GRANT EXECUTE ON FUNCTION is_workspace_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION is_workspace_public(uuid) TO authenticated;
