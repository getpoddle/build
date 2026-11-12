/*
# Decision lifecycle and approval workflow (Phase 1)

## Plain-English summary
Every decision (a workspace) now has a lifecycle status: Draft, Under Review, Approved, or Rejected.
The decision owner submits a Draft to a chosen approver. The approver can approve it, reject it with a
mandatory reason, or request changes (which returns it to Draft). Every step is written to the Decision Trail.
All transitions are enforced inside the database, not in the browser.

## 1. New table: decision_lifecycles
- `workspace_id` (uuid, primary key, references workspaces). One lifecycle row per decision. No row means Draft.
- `status` (text): one of draft, under_review, approved, rejected.
- `approver_user_id` (uuid): the approver assigned at the most recent submission.
- `submitted_by`, `submitted_at`: who last submitted the decision and when.
- `decided_by`, `decided_at`: who approved or rejected it and when (cleared on resubmission).
- `decision_note` (text): the justification for the most recent approver action (reason for rejection, or requested changes).
- `revision_count` (integer): how many times the approver has sent the decision back to Draft.
- `created_at`, `updated_at` (timestamptz).

## 2. New function: decision_lifecycle_action(p_workspace_id, p_action, p_note, p_approver_user_id)
Single entry point for every lifecycle change. Valid transitions:
- submit: Draft -> Under Review. Caller must be a workspace owner/admin or the decision owner. Approver must be an owner or admin of the workspace, and not the caller.
- approve: Under Review -> Approved. Caller must be the assigned approver.
- reject: Under Review -> Rejected. Caller must be the assigned approver. A reason is mandatory.
- request_changes: Under Review -> Draft. Caller must be the assigned approver. A note is mandatory. Revision history is kept.
- reopen: Rejected -> Draft. Same caller rules as submit.
Every successful action writes one Decision Trail event (approval_submitted, approval_approved, approval_rejected,
approval_changes_requested, approval_reopened) with the actor, timestamp, and justification in the payload.
The lifecycle row is locked while the action runs, so two approvers acting at the same time cannot both succeed.

## 3. Changed table: decision_events
- The allowed event_type list is extended with the five approval event types above. All previous event types are kept.

## 4. Security
- RLS enabled on decision_lifecycles. Only workspace members can read it (SELECT policy).
- All privileges are revoked from anon and authenticated, then SELECT is granted to authenticated only.
  There are no direct insert, update, or delete grants, so the lifecycle can only change through the function.
- The function is SECURITY DEFINER with a fixed search_path. EXECUTE is revoked from PUBLIC and anon, and granted to authenticated only.
- The function checks auth.uid(), workspace membership, the caller's role, the current status, and the assigned approver on every call.

## 5. Notes
- No existing decision rows are changed. Existing decisions simply have no lifecycle row and show as Draft.
- Idempotent: safe to re-run if the migration response is lost.
*/

CREATE TABLE IF NOT EXISTS decision_lifecycles (
  workspace_id uuid PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'under_review', 'approved', 'rejected')),
  approver_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  submitted_at timestamptz,
  decided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  decided_at timestamptz,
  decision_note text,
  revision_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_lifecycles_approver_idx ON decision_lifecycles (approver_user_id) WHERE status = 'under_review';

ALTER TABLE decision_lifecycles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON decision_lifecycles FROM anon, authenticated;
GRANT SELECT ON decision_lifecycles TO authenticated;

DROP POLICY IF EXISTS "Workspace members can read decision lifecycle" ON decision_lifecycles;
CREATE POLICY "Workspace members can read decision lifecycle"
ON decision_lifecycles FOR SELECT
TO authenticated
USING (is_workspace_member(workspace_id, auth.uid()));

ALTER TABLE decision_events DROP CONSTRAINT IF EXISTS decision_events_event_type_check;
ALTER TABLE decision_events ADD CONSTRAINT decision_events_event_type_check
  CHECK (event_type = ANY (ARRAY[
    'decision_created'::text, 'evidence_added'::text, 'agent_analysis'::text, 'challenge_raised'::text,
    'human_override'::text, 'final_decision'::text, 'outcome_logged'::text, 'team_note'::text,
    'evidence_revised'::text, 'evidence_verified'::text, 'snapshot_created'::text, 'evidence_unlinked'::text,
    'approval_submitted'::text, 'approval_approved'::text, 'approval_rejected'::text,
    'approval_changes_requested'::text, 'approval_reopened'::text
  ]));

CREATE OR REPLACE FUNCTION decision_lifecycle_action(
  p_workspace_id uuid,
  p_action text,
  p_note text DEFAULT NULL,
  p_approver_user_id uuid DEFAULT NULL
)
RETURNS decision_lifecycles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_ws workspaces%ROWTYPE;
  v_lc decision_lifecycles%ROWTYPE;
  v_role text;
  v_approver_role text;
  v_is_decision_owner boolean;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_event text;
  v_from text;
  v_to text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in' USING ERRCODE = '28000';
  END IF;

  SELECT * INTO v_ws FROM workspaces WHERE id = p_workspace_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Decision not found' USING ERRCODE = 'P0002';
  END IF;

  v_role := get_workspace_role(p_workspace_id, v_uid);
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'You are not a member of this workspace' USING ERRCODE = '42501';
  END IF;

  INSERT INTO decision_lifecycles (workspace_id) VALUES (p_workspace_id)
  ON CONFLICT (workspace_id) DO NOTHING;

  SELECT * INTO v_lc FROM decision_lifecycles WHERE workspace_id = p_workspace_id FOR UPDATE;
  v_from := v_lc.status;

  IF p_action IN ('submit', 'reopen') THEN
    v_is_decision_owner := v_role IN ('owner', 'admin')
      OR v_uid = v_ws.decision_owner_override_user_id
      OR EXISTS (
        SELECT 1 FROM domain_owners d
        WHERE d.workspace_id = p_workspace_id
          AND d.category_key = v_ws.decision_category
          AND v_uid IN (d.owner_user_id, d.backup_owner_user_id)
      );
    IF NOT v_is_decision_owner THEN
      RAISE EXCEPTION 'Only the decision owner can submit or reopen this decision' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF p_action = 'submit' THEN
    IF v_from <> 'draft' THEN
      RAISE EXCEPTION 'Only a Draft decision can be submitted (current status: %)', v_from USING ERRCODE = '22023';
    END IF;
    IF p_approver_user_id IS NULL OR p_approver_user_id = v_uid THEN
      RAISE EXCEPTION 'Choose an approver other than yourself' USING ERRCODE = '22023';
    END IF;
    SELECT role INTO v_approver_role FROM workspace_members
      WHERE workspace_id = p_workspace_id AND user_id = p_approver_user_id;
    IF v_approver_role IS NULL OR v_approver_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'The approver must be an owner or admin of this workspace' USING ERRCODE = '22023';
    END IF;

    v_to := 'under_review';
    v_event := 'approval_submitted';
    UPDATE decision_lifecycles SET
      status = v_to, approver_user_id = p_approver_user_id, submitted_by = v_uid, submitted_at = now(),
      decided_by = NULL, decided_at = NULL, decision_note = NULL, updated_at = now()
    WHERE workspace_id = p_workspace_id;

  ELSIF p_action IN ('approve', 'reject', 'request_changes') THEN
    IF v_from <> 'under_review' THEN
      RAISE EXCEPTION 'This decision is not under review (current status: %)', v_from USING ERRCODE = '22023';
    END IF;
    IF v_uid IS DISTINCT FROM v_lc.approver_user_id THEN
      RAISE EXCEPTION 'Only the assigned approver can decide on this decision' USING ERRCODE = '42501';
    END IF;
    IF v_role NOT IN ('owner', 'admin') THEN
      RAISE EXCEPTION 'Approver no longer has owner or admin access' USING ERRCODE = '42501';
    END IF;

    IF p_action = 'approve' THEN
      v_to := 'approved';
      v_event := 'approval_approved';
    ELSIF p_action = 'reject' THEN
      IF v_note IS NULL THEN
        RAISE EXCEPTION 'A reason is required to reject a decision' USING ERRCODE = '22023';
      END IF;
      v_to := 'rejected';
      v_event := 'approval_rejected';
    ELSE
      IF v_note IS NULL THEN
        RAISE EXCEPTION 'Describe the changes needed before returning the decision to Draft' USING ERRCODE = '22023';
      END IF;
      v_to := 'draft';
      v_event := 'approval_changes_requested';
    END IF;

    UPDATE decision_lifecycles SET
      status = v_to, decided_by = v_uid, decided_at = now(), decision_note = v_note,
      revision_count = revision_count + CASE WHEN p_action = 'request_changes' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE workspace_id = p_workspace_id;

  ELSIF p_action = 'reopen' THEN
    IF v_from <> 'rejected' THEN
      RAISE EXCEPTION 'Only a rejected decision can be reopened (current status: %)', v_from USING ERRCODE = '22023';
    END IF;
    v_to := 'draft';
    v_event := 'approval_reopened';
    UPDATE decision_lifecycles SET
      status = v_to, decision_note = v_note, updated_at = now()
    WHERE workspace_id = p_workspace_id;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action USING ERRCODE = '22023';
  END IF;

  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    p_workspace_id, v_event, 'user', v_uid::text,
    jsonb_build_object(
      'from_status', v_from,
      'to_status', v_to,
      'justification', v_note,
      'approver_user_id', CASE WHEN p_action = 'submit' THEN p_approver_user_id ELSE v_lc.approver_user_id END
    )
  );

  SELECT * INTO v_lc FROM decision_lifecycles WHERE workspace_id = p_workspace_id;
  RETURN v_lc;
END;
$$;

REVOKE EXECUTE ON FUNCTION decision_lifecycle_action(uuid, text, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION decision_lifecycle_action(uuid, text, text, uuid) TO authenticated;
