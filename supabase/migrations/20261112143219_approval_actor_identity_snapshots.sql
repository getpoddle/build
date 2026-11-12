/*
# Approval actor identity snapshots

## Plain-English summary
Approval history records who acted, under what name and workspace role, at the moment they acted.
Later changes to a person's name, role, or membership do not change those historical records.

## 1. Changed table: decision_approval_requests
- New snapshot columns: submitted_by_name, submitted_by_role, approver_name, approver_role,
  decided_by_name, decided_by_role. Filled only by decision_lifecycle_action.
- Existing rows are not backfilled. Their names stay empty rather than being guessed from current profiles.
- The immutability guard also freezes the submission-time snapshot columns.

## 2. Changed function: decision_lifecycle_action
- submit records submitter and approver name and role at submission time.
- approve, reject, request_changes, and withdraw record the decider's name and role.
- Approval event payloads record actor_name and actor_role.

## 3. Security
- No grant or RLS changes. Existing workspace-member read policy covers the new columns.
- Email is never stored or exposed by these columns.
*/

ALTER TABLE decision_approval_requests
  ADD COLUMN IF NOT EXISTS submitted_by_name text,
  ADD COLUMN IF NOT EXISTS submitted_by_role text,
  ADD COLUMN IF NOT EXISTS approver_name text,
  ADD COLUMN IF NOT EXISTS approver_role text,
  ADD COLUMN IF NOT EXISTS decided_by_name text,
  ADD COLUMN IF NOT EXISTS decided_by_role text;

CREATE OR REPLACE FUNCTION decision_guard_approval_request() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF pg_trigger_depth() > 1 THEN
      RETURN OLD;
    END IF;
    RAISE EXCEPTION 'Approval history cannot be deleted' USING ERRCODE = '42501';
  END IF;

  IF OLD.outcome <> 'pending' THEN
    RAISE EXCEPTION 'A decided approval request is final' USING ERRCODE = '42501';
  END IF;
  IF NEW.outcome = 'pending'
     OR NEW.workspace_id IS DISTINCT FROM OLD.workspace_id
     OR NEW.version_id IS DISTINCT FROM OLD.version_id
     OR NEW.approval_cycle IS DISTINCT FROM OLD.approval_cycle
     OR NEW.approver_user_id IS DISTINCT FROM OLD.approver_user_id
     OR NEW.submitted_by IS DISTINCT FROM OLD.submitted_by
     OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.submission_note IS DISTINCT FROM OLD.submission_note
     OR NEW.submitted_by_name IS DISTINCT FROM OLD.submitted_by_name
     OR NEW.submitted_by_role IS DISTINCT FROM OLD.submitted_by_role
     OR NEW.approver_name IS DISTINCT FROM OLD.approver_name
     OR NEW.approver_role IS DISTINCT FROM OLD.approver_role THEN
    RAISE EXCEPTION 'Only the outcome of a pending approval request can be recorded' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

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
  v_req decision_approval_requests%ROWTYPE;
  v_role text;
  v_approver_role text;
  v_approver_name text;
  v_actor_name text;
  v_is_decision_owner boolean;
  v_note text := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_event text;
  v_from text;
  v_to text;
  v_req_outcome text;
  v_hash text;
  v_version_id uuid;
  v_version_number integer;
  v_new_cycle integer;
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

  SELECT full_name INTO v_actor_name FROM profiles WHERE id = v_uid;

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
    IF v_lc.approval_cycle > 0 AND v_note IS NULL THEN
      RAISE EXCEPTION 'Explain what changed before resubmitting' USING ERRCODE = '22023';
    END IF;

    SELECT full_name INTO v_approver_name FROM profiles WHERE id = p_approver_user_id;

    v_hash := decision_material_hash(p_workspace_id);
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM decision_versions WHERE workspace_id = p_workspace_id;
    INSERT INTO decision_versions (workspace_id, version_number, content_hash, content, created_by)
    VALUES (p_workspace_id, v_version_number, v_hash, decision_material_content(p_workspace_id), v_uid)
    RETURNING id INTO v_version_id;

    v_new_cycle := v_lc.approval_cycle + 1;
    INSERT INTO decision_approval_requests (
      workspace_id, version_id, approval_cycle, approver_user_id, submitted_by, submission_note,
      submitted_by_name, submitted_by_role, approver_name, approver_role
    ) VALUES (
      p_workspace_id, v_version_id, v_new_cycle, p_approver_user_id, v_uid, v_note,
      v_actor_name, v_role, v_approver_name, v_approver_role
    );

    v_to := 'under_review';
    v_event := 'approval_submitted';
    UPDATE decision_lifecycles SET
      status = v_to,
      approver_user_id = p_approver_user_id,
      submitted_by = v_uid,
      submitted_at = now(),
      approval_cycle = v_new_cycle,
      current_version_id = v_version_id,
      bound_content_hash = v_hash,
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

    SELECT * INTO v_req FROM decision_approval_requests
    WHERE workspace_id = p_workspace_id AND outcome = 'pending' FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No pending approval request for this decision' USING ERRCODE = 'P0002';
    END IF;
    IF decision_material_hash(p_workspace_id) IS DISTINCT FROM v_lc.bound_content_hash THEN
      RAISE EXCEPTION 'The decision changed after it was submitted. It must be resubmitted.' USING ERRCODE = '22023';
    END IF;

    IF p_action = 'approve' THEN
      v_to := 'approved';
      v_event := 'approval_approved';
      v_req_outcome := 'approved';
      v_notify_type := 'approval_approved';
      v_notify_title := 'Decision approved';
      v_notify_content := '"' || v_decision_name || '" was approved.';
    ELSIF p_action = 'reject' THEN
      IF v_note IS NULL THEN
        RAISE EXCEPTION 'A reason is required to reject a decision' USING ERRCODE = '22023';
      END IF;
      v_to := 'rejected';
      v_event := 'approval_rejected';
      v_req_outcome := 'rejected';
      v_notify_type := 'approval_rejected';
      v_notify_title := 'Decision rejected';
      v_notify_content := '"' || v_decision_name || '" was rejected: ' || v_note;
    ELSE
      IF v_note IS NULL THEN
        RAISE EXCEPTION 'Describe the changes needed before returning the decision to Draft' USING ERRCODE = '22023';
      END IF;
      v_to := 'draft';
      v_event := 'approval_changes_requested';
      v_req_outcome := 'changes_requested';
      v_notify_type := 'approval_changes_requested';
      v_notify_title := 'Changes requested';
      v_notify_content := 'Changes were requested on "' || v_decision_name || '": ' || v_note;
    END IF;

    UPDATE decision_approval_requests SET
      outcome = v_req_outcome, decided_by = v_uid, decided_at = now(), justification = v_note,
      decided_by_name = v_actor_name, decided_by_role = v_role
    WHERE id = v_req.id;

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

    UPDATE decision_approval_requests SET
      outcome = 'withdrawn', decided_by = v_uid, decided_at = now(), justification = v_note,
      decided_by_name = v_actor_name, decided_by_role = v_role
    WHERE workspace_id = p_workspace_id AND outcome = 'pending';

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
      'approval_cycle', v_lc.approval_cycle,
      'version_id', v_lc.current_version_id,
      'content_hash', v_lc.bound_content_hash,
      'actor_name', v_actor_name,
      'actor_role', v_role
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
