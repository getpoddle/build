/*
# Security Hardening: Evidence Verification Permissions

## Fixes Applied

### Fix 1: Restrict verification to authorized users
- Creates `is_workspace_admin_or_owner()` helper function
- Creates `is_decision_owner()` helper function (checks domain_owners)
- Creates `is_evidence_reviewer()` helper function
- Creates `can_verify_evidence()` — the single authorization check
  that returns true for: workspace admin/owner, decision owner for the
  workspace, or an explicitly designated evidence reviewer
- Updates `reverify_decision_claim` and `request_reverification` to
  use `can_verify_evidence()` instead of `is_workspace_member()`
- `update_evidence_classification` remains member-accessible (it cannot
  set verified_fact — that path is already blocked)

### Fix 2: Remove legacy unsafe function signatures
- Drops `reverify_decision_claim(uuid)` — the old one-parameter version
  that stamped last_verified_at with no method, source, or authorization
- Revokes EXECUTE from `anon` on ALL verification functions
- Ensures only the secure 4-parameter version remains

### Fix 3: Prevent verification bypass via direct database updates
- Revokes table-level UPDATE on `decision_claims` from `authenticated` and `anon`
- Grants column-level UPDATE only on non-verification columns
- Verification columns (verification_status, verified_by, verified_at,
  verification_method, source_reference, last_verified_at, last_reviewed_at,
  supporting_notes) can ONLY be changed through the SECURITY DEFINER RPCs
- Revokes ALL privileges (INSERT, UPDATE, DELETE) on
  `claim_verification_history` from `authenticated` and `anon`
- Only SELECT remains (via the existing RLS policy)
- All writes to history go through SECURITY DEFINER RPCs only
- Adds INSERT/UPDATE/DELETE RLS policies on `decision_claims` that
  deny by default (no direct table writes by users)

### Fix 4: Terminology
- Renames the "Verified" verification status label to "Human Verified"
  in the PDF export and frontend (display only — DB value unchanged)
- Adds disclaimer text distinguishing human verification from AI confidence

### Evidence reviewer designation
- Adds `evidence_reviewers` table for explicitly designated reviewers
- RLS: workspace members can read; only admins/owners can manage
*/

-- ── 1. Helper functions for authorization ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_workspace_admin_or_owner(
  p_workspace_id uuid, p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
      AND role IN ('admin', 'owner')
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_admin_or_owner(uuid, uuid) TO authenticated;

-- Check if a user is a decision owner for the workspace (via domain_owners)
CREATE OR REPLACE FUNCTION public.is_decision_owner(
  p_workspace_id uuid, p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM domain_owners
    WHERE workspace_id = p_workspace_id
      AND (owner_user_id = p_user_id OR backup_owner_user_id = p_user_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_decision_owner(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_decision_owner(uuid, uuid) TO authenticated;

-- ── 2. Evidence reviewers table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_reviewers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE (workspace_id, user_id)
);

ALTER TABLE evidence_reviewers ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_evidence_reviewers_workspace
  ON evidence_reviewers (workspace_id);

-- RLS: workspace members can read; only admins/owners can insert/delete
DROP POLICY IF EXISTS "Workspace members can read evidence reviewers" ON evidence_reviewers;
CREATE POLICY "Workspace members can read evidence reviewers"
  ON evidence_reviewers FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can manage evidence reviewers" ON evidence_reviewers;
CREATE POLICY "Admins can manage evidence reviewers"
  ON evidence_reviewers FOR INSERT
  TO authenticated
  WITH CHECK (is_workspace_admin_or_owner(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete evidence reviewers" ON evidence_reviewers;
CREATE POLICY "Admins can delete evidence reviewers"
  ON evidence_reviewers FOR DELETE
  TO authenticated
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

-- Check if a user is an explicitly designated evidence reviewer
CREATE OR REPLACE FUNCTION public.is_evidence_reviewer(
  p_workspace_id uuid, p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM evidence_reviewers
    WHERE workspace_id = p_workspace_id
      AND user_id = p_user_id
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.is_evidence_reviewer(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_evidence_reviewer(uuid, uuid) TO authenticated;

-- ── 3. Single authorization check for evidence verification ──────────────────

CREATE OR REPLACE FUNCTION public.can_verify_evidence(
  p_workspace_id uuid, p_user_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
SET row_security TO 'off'
AS $$
BEGIN
  RETURN (
    is_workspace_admin_or_owner(p_workspace_id, p_user_id)
    OR is_decision_owner(p_workspace_id, p_user_id)
    OR is_evidence_reviewer(p_workspace_id, p_user_id)
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.can_verify_evidence(uuid, uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.can_verify_evidence(uuid, uuid) TO authenticated;

-- ── 4. Drop legacy one-parameter reverify_decision_claim ─────────────────────
-- This signature bypasses all new verification requirements. It must be
-- removed so callers cannot invoke it without a method or source.

DROP FUNCTION IF EXISTS public.reverify_decision_claim(uuid);

-- ── 5. Replace reverify_decision_claim with authorization check ──────────────

CREATE OR REPLACE FUNCTION public.reverify_decision_claim(
  p_claim_id uuid,
  p_verification_method text,
  p_source_reference text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
  v_uid uuid := auth.uid();
  v_prev_status text;
  v_claim_code text;
  v_statement text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_verification_method IS NULL OR btrim(p_verification_method) = '' THEN
    RAISE EXCEPTION 'Verification method is required';
  END IF;

  IF p_source_reference IS NULL OR btrim(p_source_reference) = '' THEN
    RAISE EXCEPTION 'Source reference is required';
  END IF;

  SELECT workspace_id, verification_status, claim_code, statement
    INTO v_workspace_id, v_prev_status, v_claim_code, v_statement
  FROM decision_claims WHERE id = p_claim_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Authorization: only admins, owners, decision owners, or designated
  -- evidence reviewers can verify evidence. Ordinary members cannot.
  IF NOT can_verify_evidence(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You are not authorized to verify evidence in this workspace';
  END IF;

  -- Record the previous state in history
  INSERT INTO claim_verification_history (
    claim_id, workspace_id, previous_status, new_status,
    reviewer_id, verification_method, source_reference, notes
  ) VALUES (
    p_claim_id, v_workspace_id, v_prev_status, 'verified',
    v_uid, p_verification_method, p_source_reference, p_notes
  );

  -- Update the claim
  UPDATE decision_claims SET
    verification_status = 'verified',
    verification_method = p_verification_method,
    source_reference = p_source_reference,
    verified_by = v_uid,
    verified_at = now(),
    last_verified_at = now(),
    last_reviewed_at = now(),
    supporting_notes = p_notes
  WHERE id = p_claim_id;

  -- Log as an auditable event
  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_workspace_id, 'team_note', 'user', v_uid,
    jsonb_build_object(
      'text', 'Human-verified evidence ' || v_claim_code || ': "' || left(v_statement, 80) || '"',
      'verification_method', p_verification_method,
      'source_reference', p_source_reference
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverify_decision_claim(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reverify_decision_claim(uuid, text, text, text) TO authenticated;

-- ── 6. Replace request_reverification with authorization check ───────────────

CREATE OR REPLACE FUNCTION public.request_reverification(
  p_claim_id uuid,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
  v_uid uuid := auth.uid();
  v_prev_status text;
  v_claim_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT workspace_id, verification_status, claim_code
    INTO v_workspace_id, v_prev_status, v_claim_code
  FROM decision_claims WHERE id = p_claim_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Any workspace member can request reverification (flag it for review),
  -- but only authorized users can actually verify.
  IF NOT is_workspace_member(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You do not have access to this workspace';
  END IF;

  INSERT INTO claim_verification_history (
    claim_id, workspace_id, previous_status, new_status,
    reviewer_id, notes
  ) VALUES (
    p_claim_id, v_workspace_id, v_prev_status, 'pending',
    v_uid, p_notes
  );

  UPDATE decision_claims SET
    verification_status = 'pending',
    last_reviewed_at = now()
  WHERE id = p_claim_id;

  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_workspace_id, 'team_note', 'user', v_uid,
    jsonb_build_object(
      'text', 'Reverification requested for ' || v_claim_code,
      'notes', p_notes
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.request_reverification(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.request_reverification(uuid, text) TO authenticated;

-- ── 7. Replace update_evidence_classification with authorization check ───────

CREATE OR REPLACE FUNCTION public.update_evidence_classification(
  p_claim_id uuid,
  p_evidence_classification text DEFAULT NULL,
  p_source_name text DEFAULT NULL,
  p_source_reference text DEFAULT NULL,
  p_supporting_document_ref text DEFAULT NULL,
  p_supporting_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_evidence_classification IS NOT NULL AND p_evidence_classification NOT IN (
    'verified_fact', 'reported_fact', 'assumption', 'ai_inference', 'unverified_claim'
  ) THEN
    RAISE EXCEPTION 'Invalid evidence classification';
  END IF;

  SELECT workspace_id INTO v_workspace_id FROM decision_claims WHERE id = p_claim_id;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  -- Classification updates require the same authorization as verification
  -- — they affect how evidence is interpreted in decisions.
  IF NOT can_verify_evidence(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You are not authorized to classify evidence in this workspace';
  END IF;

  -- Cannot set classification to 'verified_fact' here — that requires
  -- going through reverify_decision_claim with a real source and method.
  IF p_evidence_classification = 'verified_fact' THEN
    RAISE EXCEPTION 'Use the verification workflow to mark a claim as a verified fact';
  END IF;

  UPDATE decision_claims SET
    evidence_classification = COALESCE(p_evidence_classification, evidence_classification),
    source_name = COALESCE(p_source_name, source_name),
    source_reference = COALESCE(p_source_reference, source_reference),
    supporting_document_ref = COALESCE(p_supporting_document_ref, supporting_document_ref),
    supporting_notes = COALESCE(p_supporting_notes, supporting_notes),
    last_reviewed_at = now()
  WHERE id = p_claim_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.update_evidence_classification(uuid, text, text, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.update_evidence_classification(uuid, text, text, text, text, text) TO authenticated;

-- ── 8. Lock down direct table access on decision_claims ──────────────────────
-- Revoke table-level UPDATE, then grant column-level UPDATE only on
-- non-verification columns. Verification fields can only be changed
-- through SECURITY DEFINER RPCs.

REVOKE UPDATE ON decision_claims FROM authenticated;
REVOKE UPDATE ON decision_claims FROM anon;

-- Grant UPDATE only on columns that users are allowed to modify directly.
-- These are content/classification columns, NOT verification fields.
GRANT UPDATE (
  evidence_classification,
  source_name,
  source_reference,
  supporting_document_ref,
  supporting_notes,
  ai_confidence_score
) ON decision_claims TO authenticated;

-- Revoke INSERT/DELETE from anon on decision_claims (RLS has no policies
-- for these, but table-level grants still allow them)
REVOKE INSERT ON decision_claims FROM anon;
REVOKE UPDATE ON decision_claims FROM anon;
REVOKE DELETE ON decision_claims FROM anon;

-- Add deny-by-default RLS policies for INSERT/UPDATE/DELETE on decision_claims
-- These ensure no direct table writes succeed even if column grants exist.
-- All writes go through SECURITY DEFINER functions or service-role inserts
-- from the synthesis edge function.
DROP POLICY IF EXISTS "deny_decision_claims_insert" ON decision_claims;
CREATE POLICY "deny_decision_claims_insert"
  ON decision_claims FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_decision_claims_update" ON decision_claims;
CREATE POLICY "deny_decision_claims_update"
  ON decision_claims FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_decision_claims_delete" ON decision_claims;
CREATE POLICY "deny_decision_claims_delete"
  ON decision_claims FOR DELETE
  TO authenticated, anon
  USING (false);

-- ── 9. Lock down claim_verification_history completely ───────────────────────
-- No direct INSERT, UPDATE, or DELETE by any client role.
-- All writes go through SECURITY DEFINER RPCs only.
-- SELECT remains via the existing RLS policy.

REVOKE INSERT ON claim_verification_history FROM authenticated;
REVOKE INSERT ON claim_verification_history FROM anon;
REVOKE UPDATE ON claim_verification_history FROM authenticated;
REVOKE UPDATE ON claim_verification_history FROM anon;
REVOKE DELETE ON claim_verification_history FROM authenticated;
REVOKE DELETE ON claim_verification_history FROM anon;

-- Also add deny-by-default RLS policies as a second layer of defense
DROP POLICY IF EXISTS "deny_verification_history_insert" ON claim_verification_history;
CREATE POLICY "deny_verification_history_insert"
  ON claim_verification_history FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_verification_history_update" ON claim_verification_history;
CREATE POLICY "deny_verification_history_update"
  ON claim_verification_history FOR UPDATE
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_verification_history_delete" ON claim_verification_history;
CREATE POLICY "deny_verification_history_delete"
  ON claim_verification_history FOR DELETE
  TO authenticated, anon
  USING (false);
