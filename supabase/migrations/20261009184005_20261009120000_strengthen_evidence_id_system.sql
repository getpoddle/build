/*
# Strengthen Evidence ID System

## Purpose
Extends the existing `decision_claims` table to support five evidence
classifications, richer provenance, structured verification status, and a
full reverification audit trail — all while preserving every existing
Evidence ID, claim, and decision record.

## 1. New Columns on `decision_claims` (all nullable, additive)
- `evidence_classification` (text) — one of:
    'verified_fact', 'reported_fact', 'assumption',
    'ai_inference', 'unverified_claim'
  Defaults to NULL for existing rows. New AI-generated claims get
  'ai_inference'. The legacy `claim_type` column is preserved unchanged
  for backward compatibility.
- `source_name` (text) — name of the supporting source, if any.
- `source_reference` (text) — URL or citation for the source.
- `supporting_document_ref` (text) — reference to an uploaded document.
- `last_reviewed_at` (timestamptz) — date a human last reviewed this claim.
- `verification_status` (text) — one of:
    'not_verified', 'pending', 'verified', 'failed', 'expired'
  Defaults to 'not_verified' for new rows. Existing rows get 'not_verified'
  via a backfill below (only sets a value when the column is NULL, so
  nothing already populated is overwritten).
- `verification_method` (text) — how verification was performed.
- `verified_by` (uuid) — the auth.users id of the person who verified.
- `verified_at` (timestamptz) — when verification was confirmed.
- `ai_confidence_score` (numeric) — AI confidence (0–1), separate from
  the legacy `confidence` column so it is never confused with
  verification.
- `supporting_notes` (text) — free-text notes from the reviewer.

## 2. New Table: `claim_verification_history`
Tracks every verification state change, preserving the full audit trail.
- `id` (uuid PK)
- `claim_id` (uuid FK → decision_claims ON DELETE CASCADE)
- `workspace_id` (uuid FK → workspaces ON DELETE CASCADE)
- `previous_status` (text) — the status before this change
- `new_status` (text) — the status after this change
- `reviewer_id` (uuid) — who performed the change
- `verification_method` (text)
- `source_reference` (text)
- `supporting_document_ref` (text)
- `notes` (text)
- `created_at` (timestamptz DEFAULT now())

RLS: workspace members can read; only workspace members can insert
(through the RPC — direct insert is denied by not granting INSERT).

## 3. Modified Function: `reverify_decision_claim`
The existing function simply stamped `last_verified_at = now()` with no
review requirements. It is replaced with a version that:

- Requires the caller to be a workspace member (unchanged).
- Requires `p_verification_method` (non-empty text).
- Requires `p_source_reference` (non-empty text).
- Records the previous verification status in the history table.
- Sets `verification_status = 'verified'`, `verified_by = auth.uid()`,
  `verified_at = now()`, `last_reviewed_at = now()`,
  `last_verified_at = now()`.
- Stores the verification method, source reference, and notes.
- Logs a `team_note` event in the decision trail (as before).

The function signature changes from `(p_claim_id uuid)` to
`(p_claim_id uuid, p_verification_method text, p_source_reference text,
p_notes text DEFAULT NULL)`.
An overload with the old single-parameter signature is NOT created
because the old behavior (auto-verify with no review) is explicitly
disallowed by the new requirements.

## 4. New Function: `update_evidence_classification`
Allows a workspace member to update the evidence_classification and
provenance fields on a claim. SECURITY DEFINER, checks membership via
auth.uid(). Does NOT allow setting verification_status to 'verified'
(that must go through reverify_decision_claim).

## 5. New Function: `request_reverification`
Allows a workspace member to flag a claim for reverification by setting
verification_status to 'pending'. Records the previous status in history.

## 6. Security
- RLS enabled on `claim_verification_history`.
- SELECT for workspace members only.
- No direct INSERT/UPDATE/DELETE grants to anon or authenticated — all
  writes go through the SECURITY DEFINER RPCs.
- `reverify_decision_claim` and `update_evidence_classification` and
  `request_reverification` are SECURITY DEFINER with SET search_path,
  EXECUTE granted to authenticated only, revoked from anon.

## 7. Backfill
- Existing rows: `verification_status` set to 'not_verified' only where
  the column is NULL.
- No existing data is deleted or overwritten.
- The legacy `claim_type` column and all its values are untouched.
*/

-- ── 1. Add columns to decision_claims ────────────────────────────────────────
ALTER TABLE decision_claims
  ADD COLUMN IF NOT EXISTS evidence_classification text,
  ADD COLUMN IF NOT EXISTS source_name text,
  ADD COLUMN IF NOT EXISTS source_reference text,
  ADD COLUMN IF NOT EXISTS supporting_document_ref text,
  ADD COLUMN IF NOT EXISTS last_reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS verification_status text DEFAULT 'not_verified',
  ADD COLUMN IF NOT EXISTS verification_method text,
  ADD COLUMN IF NOT EXISTS verified_by uuid,
  ADD COLUMN IF NOT EXISTS verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS ai_confidence_score numeric,
  ADD COLUMN IF NOT EXISTS supporting_notes text;

-- Backfill: set verification_status only for rows where it is still NULL
UPDATE decision_claims
SET verification_status = 'not_verified'
WHERE verification_status IS NULL;

-- Add CHECK constraint for valid verification statuses (IF NOT EXISTS pattern)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decision_claims_verification_status_check'
  ) THEN
    ALTER TABLE decision_claims ADD CONSTRAINT decision_claims_verification_status_check
      CHECK (verification_status IN ('not_verified', 'pending', 'verified', 'failed', 'expired'));
  END IF;
END $$;

-- Add CHECK constraint for valid evidence classifications
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'decision_claims_evidence_classification_check'
  ) THEN
    ALTER TABLE decision_claims ADD CONSTRAINT decision_claims_evidence_classification_check
      CHECK (evidence_classification IS NULL OR evidence_classification IN (
        'verified_fact', 'reported_fact', 'assumption', 'ai_inference', 'unverified_claim'
      ));
  END IF;
END $$;

-- Index for filtering by verification status
CREATE INDEX IF NOT EXISTS idx_decision_claims_verification_status
  ON decision_claims (verification_status);

-- ── 2. Create claim_verification_history table ───────────────────────────────
CREATE TABLE IF NOT EXISTS claim_verification_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES decision_claims(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  reviewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  verification_method text,
  source_reference text,
  supporting_document_ref text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE claim_verification_history ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_claim_verification_history_claim_id
  ON claim_verification_history (claim_id);
CREATE INDEX IF NOT EXISTS idx_claim_verification_history_workspace_id
  ON claim_verification_history (workspace_id);

-- RLS: workspace members can read verification history
DROP POLICY IF EXISTS "Workspace members can read verification history"
  ON claim_verification_history;
CREATE POLICY "Workspace members can read verification history"
  ON claim_verification_history FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

-- No INSERT/UPDATE/DELETE policies — all writes go through SECURITY DEFINER RPCs

-- ── 3. Replace reverify_decision_claim ───────────────────────────────────────
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

  IF NOT is_workspace_member(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You do not have access to this workspace';
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
      'text', 'Re-verified evidence ' || v_claim_code || ': "' || left(v_statement, 80) || '"',
      'verification_method', p_verification_method,
      'source_reference', p_source_reference
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverify_decision_claim(uuid, text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.reverify_decision_claim(uuid, text, text, text) TO authenticated;

-- ── 4. Create update_evidence_classification ─────────────────────────────────
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

  IF NOT is_workspace_member(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You do not have access to this workspace';
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

-- ── 5. Create request_reverification ──────────────────────────────────────────
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
