/*
# Approval cycles, approval notifications, withdraw/amend, and append-only decision audit

## Plain-English summary
Extends the decision approval workflow. Every submission starts a numbered approval cycle, so a revised
decision that is resubmitted is clearly a new review. Owners and approvers get in-app notifications at each
approval step, without duplicates. An owner can withdraw a submission that is stuck, and can reopen an approved
decision for amendment; either way it returns to Draft and needs a new approval. The Decision Trail becomes
append-only for signed-in users.

## 1. Changed table: decision_lifecycles
- New column `approval_cycle` (integer, default 0). Increases by one on every submission. Rows that were already
  submitted are set to cycle 1.

## 2. Changed table: notifications
- Allowed types extended with approval_requested, approval_resubmitted, approval_approved, approval_rejected,
  approval_changes_requested.
- Allowed related_type extended with decision.
- Unique partial index so each user has at most one unread notification per approval type per decision.
  A newer event for the same decision refreshes that notification instead of adding another one.

## 3. Changed table: decision_events
- Allowed event types extended with approval_withdrawn and approval_amended.

## 4. Changed function: decision_lifecycle_action
- submit: starts a new cycle and notifies the approver.
- approve, reject, request_changes: notify the owner who submitted the cycle.
- withdraw (new): Under Review -> Draft, owner only. Used when the approver is no longer available.
- amend (new): Approved -> Draft, owner only, reason required.
- reopen: Rejected -> Draft (unchanged).
- Each action writes exactly one Decision Trail event, in the same transaction as the state change.

## 5. Security changes
- decision_events: UPDATE, DELETE, TRUNCATE, REFERENCES, and TRIGGER are revoked from authenticated.
  All privileges are revoked from anon. Signed-in members can still read events and add new ones.
- Approval notifications are written only by the server function.

## 6. Notes
- Safe to re-run. Existing decisions and events are not modified.
*/

ALTER TABLE decision_lifecycles ADD COLUMN IF NOT EXISTS approval_cycle integer NOT NULL DEFAULT 0;

UPDATE decision_lifecycles SET approval_cycle = 1
WHERE submitted_at IS NOT NULL AND approval_cycle = 0;

ALTER TABLE decision_events DROP CONSTRAINT IF EXISTS decision_events_event_type_check;
ALTER TABLE decision_events ADD CONSTRAINT decision_events_event_type_check CHECK (event_type = ANY (ARRAY[
  'decision_created'::text, 'evidence_added'::text, 'agent_analysis'::text, 'challenge_raised'::text,
  'human_override'::text, 'final_decision'::text, 'outcome_logged'::text, 'team_note'::text,
  'evidence_revised'::text, 'evidence_verified'::text, 'snapshot_created'::text, 'evidence_unlinked'::text,
  'approval_submitted'::text, 'approval_approved'::text, 'approval_rejected'::text,
  'approval_changes_requested'::text, 'approval_reopened'::text, 'approval_withdrawn'::text,
  'approval_amended'::text
]));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY[
  'message'::text, 'reaction'::text, 'comment'::text, 'pod_invite'::text, 'follow'::text, 'mention'::text,
  'referral'::text, 'forecast_resolved'::text, 'workspace_invite_accepted'::text,
  'workspace_team_message'::text, 'workspace_ai_activity'::text, 'workspace_team_mention'::text,
  'account_deletion_requested'::text, 'account_restored'::text,
  'approval_requested'::text, 'approval_resubmitted'::text, 'approval_approved'::text,
  'approval_rejected'::text, 'approval_changes_requested'::text
]));

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_related_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_related_type_check CHECK (related_type IS NULL OR related_type = ANY (ARRAY[
  'message'::text, 'insight'::text, 'comment'::text, 'conversation'::text, 'workspace'::text,
  'organization'::text, 'workspace_chat'::text, 'account'::text, 'challenge'::text, 'assumption'::text,
  'decision'::text
]));

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unread_decision_key
  ON notifications (user_id, type, related_id)
  WHERE is_read = false AND related_type = 'decision';

REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON decision_events FROM authenticated;
REVOKE ALL ON decision_events FROM anon;

CREATE OR REPLACE FUNCTION public.decision_lifecycle_action(
  p_workspace_id uuid,
  p_action text,
  p_note text DEFAULT NULL,
  p_approver_user_id uuid DEFAULT NULL
)
RETURNS decision_lifecycles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
  v_notify_user uuid;
  v_notify_type text;
  v_notify_title text;
  v_notify_content text;
  v_decision_name text;
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
  v_decision_name := COALESCE(NULLIF(btrim(v_ws.name), ''), 'your decision');

  IF p_action IN ('submit', 'reopen', 'withdraw', 'amend') THEN
    v_is_decision_owner := v_role IN ('owner', 'admin')
      OR v_uid = v_ws.decision_owner_override_user_id
      OR EXISTS (
        SELECT 1 FROM domain_owners d
        WHERE d.workspace_id = p_workspace_id
          AND d.category_key = v_ws.decision_category
          AND v_uid IN (d.owner_user_id, d.backup_owner_user_id)
      );
    IF NOT v_is_decision_owner THEN
      RAISE EXCEPTION 'Only the decision owner can change this approval' USING ERRCODE = '42501';
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
      status = v_to,
      approver_user_id = p_approver_user_id,
      submitted_by = v_uid,
      submitted_at = now(),
      approval_cycle = approval_cycle + 1,
      decided_by = NULL,
      decided_at = NULL,
      decision_note = NULL,
      updated_at = now()
    WHERE workspace_id = p_workspace_id;

    v_notify_user := p_approver_user_id;
    v_notify_type := CASE WHEN v_lc.approval_cycle > 0 THEN 'approval_resubmitted' ELSE 'approval_requested' END;
    v_notify_title := CASE WHEN v_lc.approval_cycle > 0 THEN 'Decision resubmitted for approval' ELSE 'Approval requested' END;
    v_notify_content := '"' || v_decision_name || '" is waiting for your review.';

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
      v_notify_type := 'approval_approved';
      v_notify_title := 'Decision approved';
      v_notify_content := '"' || v_decision_name || '" was approved.';
    ELSIF p_action = 'reject' THEN
      IF v_note IS NULL THEN
        RAISE EXCEPTION 'A reason is required to reject a decision' USING ERRCODE = '22023';
      END IF;
      v_to := 'rejected';
      v_event := 'approval_rejected';
      v_notify_type := 'approval_rejected';
      v_notify_title := 'Decision rejected';
      v_notify_content := '"' || v_decision_name || '" was rejected: ' || v_note;
    ELSE
      IF v_note IS NULL THEN
        RAISE EXCEPTION 'Describe the changes needed before returning the decision to Draft' USING ERRCODE = '22023';
      END IF;
      v_to := 'draft';
      v_event := 'approval_changes_requested';
      v_notify_type := 'approval_changes_requested';
      v_notify_title := 'Changes requested';
      v_notify_content := 'Changes were requested on "' || v_decision_name || '": ' || v_note;
    END IF;

    UPDATE decision_lifecycles SET
      status = v_to,
      decided_by = v_uid,
      decided_at = now(),
      decision_note = v_note,
      revision_count = revision_count + CASE WHEN p_action = 'request_changes' THEN 1 ELSE 0 END,
      updated_at = now()
    WHERE workspace_id = p_workspace_id;

    v_notify_user := v_lc.submitted_by;

  ELSIF p_action = 'withdraw' THEN
    IF v_from <> 'under_review' THEN
      RAISE EXCEPTION 'Only a decision under review can be withdrawn (current status: %)', v_from USING ERRCODE = '22023';
    END IF;
    v_to := 'draft';
    v_event := 'approval_withdrawn';
    UPDATE decision_lifecycles SET
      status = v_to, decision_note = v_note, updated_at = now()
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

  ELSIF p_action = 'amend' THEN
    IF v_from <> 'approved' THEN
      RAISE EXCEPTION 'Only an approved decision can be amended (current status: %)', v_from USING ERRCODE = '22023';
    END IF;
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'Describe what is changing before amending an approved decision' USING ERRCODE = '22023';
    END IF;
    v_to := 'draft';
    v_event := 'approval_amended';
    UPDATE decision_lifecycles SET
      status = v_to, decision_note = v_note, updated_at = now()
    WHERE workspace_id = p_workspace_id;

  ELSE
    RAISE EXCEPTION 'Unknown action: %', p_action USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_lc FROM decision_lifecycles WHERE workspace_id = p_workspace_id;

  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    p_workspace_id, v_event, 'user', v_uid::text,
    jsonb_build_object(
      'from_status', v_from,
      'to_status', v_to,
      'justification', v_note,
      'approver_user_id', v_lc.approver_user_id,
      'approval_cycle', v_lc.approval_cycle
    )
  );

  IF v_notify_user IS NOT NULL THEN
    INSERT INTO notifications (user_id, type, title, content, related_id, related_type, actor_id)
    VALUES (v_notify_user, v_notify_type, v_notify_title, v_notify_content, p_workspace_id, 'decision', v_uid)
    ON CONFLICT (user_id, type, related_id) WHERE is_read = false AND related_type = 'decision'
    DO UPDATE SET
      title = EXCLUDED.title,
      content = EXCLUDED.content,
      actor_id = EXCLUDED.actor_id,
      created_at = now();
  END IF;

  RETURN v_lc;
END;
$function$;
