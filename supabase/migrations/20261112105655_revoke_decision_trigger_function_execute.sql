/*
# Restrict decision trigger functions to the database engine

## Plain-English summary
Two helper functions that only run automatically when a decision's records change were callable by signed-in
and anonymous app roles. They are now restricted so only the database itself can run them.

## Security changes
- Revokes execute on decision_block_version_changes and decision_guard_approval_request from PUBLIC, anon, and authenticated.
- Trigger firing is unaffected; this only removes direct calls.
*/

REVOKE EXECUTE ON FUNCTION decision_block_version_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION decision_guard_approval_request() FROM PUBLIC, anon, authenticated;
