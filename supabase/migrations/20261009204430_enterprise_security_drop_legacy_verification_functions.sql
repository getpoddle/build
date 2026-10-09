/*
# Drop Legacy Vulnerable Function Signatures

## Summary
The old approve_verification(target_user_id uuid, admin_user_id uuid) and
reject_verification(target_user_id uuid, admin_user_id uuid) signatures still
exist alongside the fixed single-parameter versions. The old signatures are
callable by authenticated users and accept admin_user_id from the client,
making the privilege escalation still exploitable.

## Changes
1. DROP the old 2-parameter versions of both functions.
2. Verify only the secure 1-parameter versions remain.

## Security
- Completes the fix for CRITICAL privilege escalation in verification functions.
*/

DROP FUNCTION IF EXISTS approve_verification(uuid, uuid);
DROP FUNCTION IF EXISTS reject_verification(uuid, uuid);
