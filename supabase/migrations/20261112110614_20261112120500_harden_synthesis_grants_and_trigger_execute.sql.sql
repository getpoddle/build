/*
# Harden grants on AI recommendation storage and an anon-callable trigger function

1. Modified Tables
- `workspace_synthesis`: the anonymous role loses every privilege except reading. Its read access stays so public workspaces still show their synthesis. The signed-in role loses TRUNCATE, REFERENCES, and TRIGGER, which are not used. Insert, update, and delete for signed-in members remain, because the app deletes synthesis when a workspace is reset and the row-level policies still limit writes to members.

2. Modified Functions
- `log_decision_evidence_link`: a trigger function. EXECUTE is revoked from the public and anonymous roles. Triggers fire without EXECUTE privilege, so existing evidence-link triggers keep working.

3. Security
- Row-level policies on `workspace_synthesis` are unchanged. This migration only removes privileges that no policy or app path uses.

4. Important Notes
- Anonymous writes to synthesis were already rejected by row-level policies. This change removes the grant so a future policy mistake cannot expose them.
*/

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON workspace_synthesis FROM anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON workspace_synthesis FROM authenticated;

REVOKE EXECUTE ON FUNCTION public.log_decision_evidence_link() FROM PUBLIC, anon;
