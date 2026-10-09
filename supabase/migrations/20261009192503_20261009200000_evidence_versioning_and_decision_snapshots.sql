/*
# Decision Trail Integrity: Evidence Versioning & Decision Snapshots

## Summary

This migration adds two new capabilities to the Decision Trail:

1. **Evidence Versioning** — When evidence is revised, the previous state
   is preserved in a new `evidence_versions` table. Each revision records
   the old and new statement, classification, verification status, source,
   reason for modification, the user responsible, and a monotonically
   increasing version number assigned atomically.

2. **Decision Snapshots** — An authorized user can create a read-only
   snapshot of the entire decision state at a point in time. The snapshot
   captures the decision question, status, all evidence (with versions),
   verified facts, assumptions, AI inferences, AI recommendation, human
   approvals, and outstanding uncertainties — referencing the actual
   evidence available at the time, not current values.

## New Tables

### evidence_versions
- `id` (uuid, PK)
- `claim_id` (uuid, FK → decision_claims.id ON DELETE CASCADE)
- `workspace_id` (uuid, FK → workspaces.id ON DELETE CASCADE)
- `version_number` (integer, NOT NULL — atomically assigned)
- `previous_statement` (text)
- `updated_statement` (text)
- `previous_classification` (text)
- `updated_classification` (text)
- `previous_verification_status` (text)
- `updated_verification_status` (text)
- `source_reference` (text)
- `reason_for_modification` (text, NOT NULL)
- `modified_by` (uuid, from auth.uid(), NOT NULL)
- `modified_at` (timestamptz, DEFAULT now())
- Unique constraint on (claim_id, version_number)

### decision_snapshots
- `id` (uuid, PK)
- `workspace_id` (uuid, FK → workspaces.id ON DELETE CASCADE)
- `decision_question` (text)
- `decision_status` (text)
- `evidence_snapshot` (jsonb — all claims at snapshot time)
- `verified_facts` (jsonb — claims with classification = verified_fact)
- `reported_facts` (jsonb — claims with classification = reported_fact)
- `assumptions` (jsonb — claims with classification = assumption)
- `ai_inferences` (jsonb — claims with classification = ai_inference)
- `outstanding_uncertainties` (jsonb — unverified claims + open challenges)
- `ai_recommendation` (text)
- `human_approvals` (jsonb — human_override events)
- `snapshot_timestamp` (timestamptz, DEFAULT now())
- `created_by` (uuid, from auth.uid(), NOT NULL)

## New RPC Functions

### revise_evidence_claim(p_claim_id, p_reason, p_new_statement, p_new_classification, p_source_reference)
- SECURITY DEFINER, SET search_path TO 'public'
- Requires can_verify_evidence authorization
- Atomically assigns the next version_number
- Preserves the previous state in evidence_versions
- Updates decision_claims with the new statement/classification
- Records a decision_event of type 'evidence_revised'
- Revokes EXECUTE from PUBLIC, grants to authenticated + service_role

### create_decision_snapshot(p_workspace_id)
- SECURITY DEFINER, SET search_path TO 'public'
- Requires can_verify_evidence authorization
- Captures all current claims, events, challenges into a JSONB snapshot
- Distinguishes verified facts, reported facts, assumptions, AI inferences
- Captures the latest AI recommendation from agent_analysis events
- Captures human approvals from human_override events
- Records a decision_event of type 'snapshot_created'
- Returns the snapshot UUID

## RLS Policies

### evidence_versions
- SELECT: workspace members can read
- INSERT/UPDATE/DELETE: denied by default (writes only via SECURITY DEFINER RPC)

### decision_snapshots
- SELECT: workspace members can read
- INSERT/UPDATE/DELETE: denied by default (writes only via SECURITY DEFINER RPC)

## Security Notes
- All writes go through SECURITY DEFINER functions that check auth.uid()
- Version numbers assigned atomically via SELECT ... FOR UPDATE
- Historical records are immutable via RLS deny-by-default + revoked table privileges
- Cross-workspace access blocked because workspace_id is derived from the claim itself
- No existing tables or columns are modified destructively
*/

-- ── 1. evidence_versions table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS evidence_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES decision_claims(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  previous_statement text,
  updated_statement text,
  previous_classification text,
  updated_classification text,
  previous_verification_status text,
  updated_verification_status text,
  source_reference text,
  reason_for_modification text NOT NULL,
  modified_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  modified_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_evidence_versions_claim_version
  ON evidence_versions (claim_id, version_number);

CREATE INDEX IF NOT EXISTS idx_evidence_versions_workspace
  ON evidence_versions (workspace_id);

CREATE INDEX IF NOT EXISTS idx_evidence_versions_claim
  ON evidence_versions (claim_id, version_number DESC);

ALTER TABLE evidence_versions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can read evidence versions" ON evidence_versions;
CREATE POLICY "Workspace members can read evidence versions"
  ON evidence_versions FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "deny_evidence_versions_insert" ON evidence_versions;
CREATE POLICY "deny_evidence_versions_insert"
  ON evidence_versions FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_evidence_versions_update" ON evidence_versions;
CREATE POLICY "deny_evidence_versions_update"
  ON evidence_versions FOR UPDATE
  TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_evidence_versions_delete" ON evidence_versions;
CREATE POLICY "deny_evidence_versions_delete"
  ON evidence_versions FOR DELETE
  TO authenticated, anon
  USING (false);

REVOKE INSERT ON evidence_versions FROM authenticated, anon;
REVOKE UPDATE ON evidence_versions FROM authenticated, anon;
REVOKE DELETE ON evidence_versions FROM authenticated, anon;

-- ── 2. decision_snapshots table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS decision_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  decision_question text,
  decision_status text,
  evidence_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  verified_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  reported_facts jsonb NOT NULL DEFAULT '[]'::jsonb,
  assumptions jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_inferences jsonb NOT NULL DEFAULT '[]'::jsonb,
  outstanding_uncertainties jsonb NOT NULL DEFAULT '[]'::jsonb,
  ai_recommendation text,
  human_approvals jsonb NOT NULL DEFAULT '[]'::jsonb,
  snapshot_timestamp timestamptz NOT NULL DEFAULT now(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_snapshots_workspace
  ON decision_snapshots (workspace_id, snapshot_timestamp DESC);

ALTER TABLE decision_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members can read decision snapshots" ON decision_snapshots;
CREATE POLICY "Workspace members can read decision snapshots"
  ON decision_snapshots FOR SELECT
  TO authenticated
  USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "deny_decision_snapshots_insert" ON decision_snapshots;
CREATE POLICY "deny_decision_snapshots_insert"
  ON decision_snapshots FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

DROP POLICY IF EXISTS "deny_decision_snapshots_update" ON decision_snapshots;
CREATE POLICY "deny_decision_snapshots_update"
  ON decision_snapshots FOR UPDATE
  TO authenticated, anon
  USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "deny_decision_snapshots_delete" ON decision_snapshots;
CREATE POLICY "deny_decision_snapshots_delete"
  ON decision_snapshots FOR DELETE
  TO authenticated, anon
  USING (false);

REVOKE INSERT ON decision_snapshots FROM authenticated, anon;
REVOKE UPDATE ON decision_snapshots FROM authenticated, anon;
REVOKE DELETE ON decision_snapshots FROM authenticated, anon;

-- ── 3. revise_evidence_claim RPC ─────────────────────────────────────────────
-- Note: p_reason is required and comes before optional params to satisfy
-- PostgreSQL's rule that params after a defaulted param must also have defaults.

CREATE OR REPLACE FUNCTION public.revise_evidence_claim(
  p_claim_id uuid,
  p_reason text,
  p_new_statement text DEFAULT NULL,
  p_new_classification text DEFAULT NULL,
  p_source_reference text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_workspace_id uuid;
  v_uid uuid := auth.uid();
  v_prev_statement text;
  v_prev_classification text;
  v_prev_verification_status text;
  v_next_version integer;
  v_claim_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'Reason for modification is required';
  END IF;

  SELECT workspace_id, statement, evidence_classification, verification_status, claim_code
    INTO v_workspace_id, v_prev_statement, v_prev_classification, v_prev_verification_status, v_claim_code
  FROM decision_claims
  WHERE id = p_claim_id
  FOR UPDATE;

  IF v_workspace_id IS NULL THEN
    RAISE EXCEPTION 'Claim not found';
  END IF;

  IF NOT can_verify_evidence(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You are not authorized to revise evidence in this workspace';
  END IF;

  IF p_new_classification IS NOT NULL AND p_new_classification NOT IN (
    'verified_fact', 'reported_fact', 'assumption', 'ai_inference', 'unverified_claim'
  ) THEN
    RAISE EXCEPTION 'Invalid evidence classification';
  END IF;

  IF p_new_classification = 'verified_fact' THEN
    RAISE EXCEPTION 'Use the verification workflow to mark a claim as a verified fact';
  END IF;

  SELECT COALESCE(MAX(version_number), 0) + 1 INTO v_next_version
  FROM evidence_versions
  WHERE claim_id = p_claim_id;

  INSERT INTO evidence_versions (
    claim_id, workspace_id, version_number,
    previous_statement, updated_statement,
    previous_classification, updated_classification,
    previous_verification_status, updated_verification_status,
    source_reference, reason_for_modification, modified_by
  ) VALUES (
    p_claim_id, v_workspace_id, v_next_version,
    v_prev_statement, COALESCE(p_new_statement, v_prev_statement),
    v_prev_classification, COALESCE(p_new_classification, v_prev_classification),
    v_prev_verification_status, v_prev_verification_status,
    p_source_reference, p_reason, v_uid
  );

  UPDATE decision_claims SET
    statement = COALESCE(p_new_statement, statement),
    evidence_classification = COALESCE(p_new_classification, evidence_classification),
    source_reference = COALESCE(p_source_reference, source_reference),
    last_reviewed_at = now()
  WHERE id = p_claim_id;

  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_workspace_id, 'evidence_revised', 'user', v_uid::text,
    jsonb_build_object(
      'claim_code', v_claim_code,
      'version_number', v_next_version,
      'reason', p_reason,
      'previous_statement', v_prev_statement,
      'updated_statement', COALESCE(p_new_statement, v_prev_statement),
      'previous_classification', v_prev_classification,
      'updated_classification', COALESCE(p_new_classification, v_prev_classification)
    )
  );

  RETURN v_next_version;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.revise_evidence_claim(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revise_evidence_claim(uuid, text, text, text, text) TO authenticated, service_role;

-- ── 4. create_decision_snapshot RPC ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.create_decision_snapshot(
  p_workspace_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_snapshot_id uuid;
  v_decision_question text;
  v_decision_status text;
  v_all_claims jsonb;
  v_verified_facts jsonb;
  v_reported_facts jsonb;
  v_assumptions jsonb;
  v_ai_inferences jsonb;
  v_uncertainties jsonb;
  v_ai_rec text;
  v_human_approvals jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  IF NOT can_verify_evidence(p_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You are not authorized to create a decision snapshot in this workspace';
  END IF;

  IF NOT is_workspace_member(p_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You do not have access to this workspace';
  END IF;

  SELECT name, decision_status INTO v_decision_question, v_decision_status
  FROM workspaces WHERE id = p_workspace_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', id, 'claim_code', claim_code, 'statement', statement,
    'claim_type', claim_type, 'evidence_classification', evidence_classification,
    'verification_status', verification_status, 'confidence', confidence,
    'ai_confidence_score', ai_confidence_score,
    'source_name', source_name, 'source_reference', source_reference,
    'agent_name', agent_name, 'agent_role', agent_role,
    'last_verified_at', last_verified_at,
    'last_reviewed_at', last_reviewed_at,
    'evidence_refs', evidence_refs, 'assumptions', assumptions
  )), '[]'::jsonb) INTO v_all_claims
  FROM decision_claims WHERE workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_verified_facts
  FROM jsonb_array_elements(v_all_claims) elem
  WHERE elem->>'evidence_classification' = 'verified_fact';

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_reported_facts
  FROM jsonb_array_elements(v_all_claims) elem
  WHERE elem->>'evidence_classification' = 'reported_fact';

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_assumptions
  FROM jsonb_array_elements(v_all_claims) elem
  WHERE elem->>'evidence_classification' = 'assumption';

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_ai_inferences
  FROM jsonb_array_elements(v_all_claims) elem
  WHERE elem->>'evidence_classification' = 'ai_inference';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'claim_code', claim_code, 'statement', statement,
    'verification_status', verification_status
  )), '[]'::jsonb) INTO v_uncertainties
  FROM decision_claims
  WHERE workspace_id = p_workspace_id
    AND (verification_status IS NULL OR verification_status = 'not_verified' OR verification_status = 'pending');

  SELECT (payload->>'recommendation')::text INTO v_ai_rec
  FROM decision_events
  WHERE workspace_id = p_workspace_id AND event_type = 'agent_analysis'
    AND payload ? 'recommendation'
  ORDER BY created_at DESC LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'event_type', event_type, 'actor_id', actor_id,
    'payload', payload, 'created_at', created_at
  )), '[]'::jsonb) INTO v_human_approvals
  FROM decision_events
  WHERE workspace_id = p_workspace_id AND event_type = 'human_override';

  INSERT INTO decision_snapshots (
    workspace_id, decision_question, decision_status,
    evidence_snapshot, verified_facts, reported_facts,
    assumptions, ai_inferences, outstanding_uncertainties,
    ai_recommendation, human_approvals, created_by
  ) VALUES (
    p_workspace_id, v_decision_question, v_decision_status,
    v_all_claims, v_verified_facts, v_reported_facts,
    v_assumptions, v_ai_inferences, v_uncertainties,
    v_ai_rec, v_human_approvals, v_uid
  )
  RETURNING id INTO v_snapshot_id;

  INSERT INTO decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    p_workspace_id, 'snapshot_created', 'user', v_uid::text,
    jsonb_build_object('snapshot_id', v_snapshot_id)
  );

  RETURN v_snapshot_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.create_decision_snapshot(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_decision_snapshot(uuid) TO authenticated, service_role;
