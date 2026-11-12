/*
# Decision version integrity and approval history

## Plain-English summary
Every submission for approval now freezes a numbered version of the decision's material content, and each
approval attempt is recorded as its own append-only request bound to that exact version. If anything material
changes while a decision is under review or approved, the pending or existing approval is marked superseded
or cleared automatically on the server, so an old approval can never authorize changed content. Approved
versions are kept; they are never edited.

## 1. New table: decision_versions (append-only)
- One row per submission: version number, content hash (SHA-256), and a frozen copy of the material content.
- Material content = workspace name, description, decision status, category, domain, and every claim's
  statement, type, assumptions, confidence, verification status, evidence classification, source reference,
  and the hashes of the evidence files linked to it.
- Rows cannot be updated. Rows are deleted only when their workspace is deleted.

## 2. New table: decision_approval_requests (append-only history)
- One row per approval attempt: version, approval cycle, approver, submitter, submission time, outcome,
  decider, decision time, justification.
- Outcomes: pending, approved, rejected, changes_requested, withdrawn, superseded.
- Once an attempt leaves pending it is final. Its submission fields can never change.
- At most one pending attempt per decision.
- Existing decisions have no historical attempts recorded here; their history remains in the Decision Trail.

## 3. Changed table: decision_lifecycles
- New `current_version_id` and `bound_content_hash`: the version currently under review or approved.

## 4. Automatic invalidation
- A trigger runs when material content changes (decision fields, claims, claim evidence links).
- If the decision is Under Review, the pending attempt becomes superseded and the decision returns to Draft.
- If the decision is Approved, it returns to Draft. The approved version and its attempt record are kept.
- Each change writes a Decision Trail event (approval_superseded).
- Changes are checked on the server, so edits made outside the app are covered.

## 5. Changed function: decision_lifecycle_action
- submit creates a new version and a new approval attempt bound to it. Resubmission requires an explanation.
- approve, reject, and request_changes finalize the pending attempt and verify the content hash still matches.
- withdraw finalizes the pending attempt as withdrawn.
- All actions lock the decision row, so concurrent edits and approvals serialize.

## 6. Security
- decision_versions and decision_approval_requests: members can read; no client insert, update, or delete.
- Triggers block updates and deletes from users on version rows and on decided approval rows.
- The material-content helpers are server-only (not callable by app users).
- decision_events: approval_superseded added to the allowed event types.

## 7. Notes
- Idempotent: safe to re-run.
- Existing decision records and Decision Trail events are not modified.
- The approved version a decision was last approved under is preserved; no approval is inferred for older cycles.
*/

CREATE TABLE IF NOT EXISTS decision_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_number integer NOT NULL CHECK (version_number >= 1),
  content_hash text NOT NULL,
  content jsonb NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, version_number)
);

CREATE TABLE IF NOT EXISTS decision_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_id uuid NOT NULL REFERENCES decision_versions(id) ON DELETE CASCADE,
  approval_cycle integer NOT NULL CHECK (approval_cycle >= 1),
  approver_user_id uuid NOT NULL,
  submitted_by uuid NOT NULL,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  submission_note text,
  outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending', 'approved', 'rejected', 'changes_requested', 'withdrawn', 'superseded')),
  decided_by uuid,
  decided_at timestamptz,
  justification text,
  UNIQUE (workspace_id, approval_cycle),
  CHECK ((outcome = 'pending') = (decided_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS decision_approval_one_pending
  ON decision_approval_requests (workspace_id) WHERE outcome = 'pending';
CREATE INDEX IF NOT EXISTS idx_decision_approval_requests_version ON decision_approval_requests (version_id);

ALTER TABLE decision_lifecycles ADD COLUMN IF NOT EXISTS current_version_id uuid REFERENCES decision_versions(id) ON DELETE SET NULL;
ALTER TABLE decision_lifecycles ADD COLUMN IF NOT EXISTS bound_content_hash text;

ALTER TABLE decision_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_approval_requests ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON decision_versions FROM anon, authenticated;
REVOKE ALL ON decision_approval_requests FROM anon, authenticated;
GRANT SELECT ON decision_versions TO authenticated;
GRANT SELECT ON decision_approval_requests TO authenticated;

DROP POLICY IF EXISTS "Workspace members can read decision versions" ON decision_versions;
CREATE POLICY "Workspace members can read decision versions" ON decision_versions FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Workspace members can read approval requests" ON decision_approval_requests;
CREATE POLICY "Workspace members can read approval requests" ON decision_approval_requests FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION decision_block_version_changes() RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'Decision versions are permanent and cannot be changed' USING ERRCODE = '42501';
END;
$$;

DROP TRIGGER IF EXISTS decision_versions_immutable ON decision_versions;
CREATE TRIGGER decision_versions_immutable BEFORE UPDATE OR DELETE ON decision_versions
  FOR EACH ROW EXECUTE FUNCTION decision_block_version_changes();

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
     OR NEW.submission_note IS DISTINCT FROM OLD.submission_note THEN
    RAISE EXCEPTION 'Only the outcome of a pending approval request can be recorded' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS decision_approval_requests_guard ON decision_approval_requests;
CREATE TRIGGER decision_approval_requests_guard BEFORE UPDATE OR DELETE ON decision_approval_requests
  FOR EACH ROW EXECUTE FUNCTION decision_guard_approval_request();

CREATE OR REPLACE FUNCTION decision_material_content(p_workspace_id uuid) RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'workspace', (
      SELECT jsonb_build_object(
        'name', w.name,
        'description', w.description,
        'decision_status', w.decision_status,
        'decision_category', w.decision_category,
        'domain', w.domain
      )
      FROM workspaces w WHERE w.id = p_workspace_id
    ),
    'claims', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object(
          'claim_code', c.claim_code,
          'statement', c.statement,
          'claim_type', c.claim_type,
          'assumptions', c.assumptions,
          'confidence', c.confidence,
          'verification_status', c.verification_status,
          'evidence_classification', c.evidence_classification,
          'source_reference', c.source_reference,
          'evidence_sha256', COALESCE((
            SELECT jsonb_agg(f.sha256_hex ORDER BY f.sha256_hex)
            FROM decision_claim_evidence ce
            JOIN decision_evidence_files f ON f.id = ce.evidence_file_id
            WHERE ce.claim_id = c.id
          ), '[]'::jsonb)
        )
        ORDER BY c.claim_code, c.id
      )
      FROM decision_claims c
      WHERE c.workspace_id = p_workspace_id
    ), '[]'::jsonb)
  )
$$;

CREATE OR REPLACE FUNCTION decision_material_hash(p_workspace_id uuid) RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT encode(sha256(convert_to(decision_material_content(p_workspace_id)::text, 'UTF8')), 'hex')
$$;

REVOKE EXECUTE ON FUNCTION decision_material_content(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION decision_material_hash(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION decision_invalidate_on_material_change() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws uuid;
  v_lc decision_lifecycles%ROWTYPE;
  v_hash text;
  v_uid uuid := auth.uid();
BEGIN
  IF TG_TABLE_NAME = 'workspaces' THEN
    v_ws := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_ws := OLD.workspace_id;
  ELSE
    v_ws := NEW.workspace_id;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM workspaces WHERE id = v_ws) THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_lc FROM decision_lifecycles WHERE workspace_id = v_ws FOR UPDATE;
  IF NOT FOUND OR v_lc.status NOT IN ('under_review', 'approved') THEN
    RETURN NULL;
  END IF;

  v_hash := decision_material_hash(v_ws);
  IF v_lc.bound_content_hash IS NOT NULL AND v_lc.bound_content_hash = v_hash THEN
    RETURN NULL;
  END IF;

  IF v_lc.status = 'under_review' THEN
    UPDATE decision_approval_requests
    SET outcome = 'superseded', decided_at = now(),
        justification = 'The decision changed after it was submitted.'
    WHERE workspace_id = v_ws AND outcome = 'pending';
  END IF;

  UPDATE decision_lifecycles SET status = 'draft', updated_at = now() WHERE workspace_id = v_ws;

  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_ws, 'approval_superseded',
    CASE WHEN v_uid IS NULL THEN 'system' ELSE 'user' END,
    COALESCE(v_uid::text, 'system'),
    jsonb_build_object(
      'from_status', v_lc.status,
      'to_status', 'draft',
      'approval_cycle', v_lc.approval_cycle,
      'version_id', v_lc.current_version_id,
      'bound_content_hash', v_lc.bound_content_hash,
      'current_content_hash', v_hash,
      'justification', CASE WHEN v_lc.status = 'approved'
        THEN 'The approved decision changed. A new approval is required before it counts as approved.'
        ELSE 'The decision changed after it was submitted. Resubmit it for approval.' END
    )
  );

  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION decision_invalidate_on_material_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS decision_material_change_workspaces ON workspaces;
CREATE TRIGGER decision_material_change_workspaces AFTER UPDATE ON workspaces
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name
     OR OLD.description IS DISTINCT FROM NEW.description
     OR OLD.decision_status IS DISTINCT FROM NEW.decision_status
     OR OLD.decision_category IS DISTINCT FROM NEW.decision_category
     OR OLD.domain IS DISTINCT FROM NEW.domain)
  EXECUTE FUNCTION decision_invalidate_on_material_change();

DROP TRIGGER IF EXISTS decision_material_change_claims ON decision_claims;
CREATE TRIGGER decision_material_change_claims AFTER INSERT OR DELETE ON decision_claims
  FOR EACH ROW EXECUTE FUNCTION decision_invalidate_on_material_change();

DROP TRIGGER IF EXISTS decision_material_change_claim_edits ON decision_claims;
CREATE TRIGGER decision_material_change_claim_edits AFTER UPDATE OF claim_code, statement, claim_type, assumptions, confidence, verification_status, evidence_classification, source_reference ON decision_claims
  FOR EACH ROW EXECUTE FUNCTION decision_invalidate_on_material_change();

DROP TRIGGER IF EXISTS decision_material_change_evidence_links ON decision_claim_evidence;
CREATE TRIGGER decision_material_change_evidence_links AFTER INSERT OR DELETE ON decision_claim_evidence
  FOR EACH ROW EXECUTE FUNCTION decision_invalidate_on_material_change();

ALTER TABLE decision_events DROP CONSTRAINT IF EXISTS decision_events_event_type_check;
ALTER TABLE decision_events ADD CONSTRAINT decision_events_event_type_check CHECK (event_type = ANY (ARRAY[
  'decision_created'::text, 'evidence_added'::text, 'agent_analysis'::text, 'challenge_raised'::text,
  'human_override'::text, 'final_decision'::text, 'outcome_logged'::text, 'team_note'::text,
  'evidence_revised'::text, 'evidence_verified'::text, 'snapshot_created'::text, 'evidence_unlinked'::text,
  'approval_submitted'::text, 'approval_approved'::text, 'approval_rejected'::text,
  'approval_changes_requested'::text, 'approval_reopened'::text, 'approval_withdrawn'::text,
  'approval_amended'::text, 'approval_superseded'::text
]));

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

    v_hash := decision_material_hash(p_workspace_id);
    SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_version_number
    FROM decision_versions WHERE workspace_id = p_workspace_id;
    INSERT INTO decision_versions (workspace_id, version_number, content_hash, content, created_by)
    VALUES (p_workspace_id, v_version_number, v_hash, decision_material_content(p_workspace_id), v_uid)
    RETURNING id INTO v_version_id;

    v_new_cycle := v_lc.approval_cycle + 1;
    INSERT INTO decision_approval_requests (
      workspace_id, version_id, approval_cycle, approver_user_id, submitted_by, submission_note
    ) VALUES (p_workspace_id, v_version_id, v_new_cycle, p_approver_user_id, v_uid, v_note);

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
      outcome = v_req_outcome, decided_by = v_uid, decided_at = now(), justification = v_note
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
      outcome = 'withdrawn', decided_by = v_uid, decided_at = now(), justification = v_note
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
      'content_hash', v_lc.bound_content_hash
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
