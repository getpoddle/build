-- Fix: create_decision_snapshot was gated behind can_verify_evidence,
-- which requires admin/owner/decision-owner/evidence-reviewer roles.
-- A snapshot is a read-only capture — any workspace member should be able
-- to create one. Replace the authorization check with is_workspace_member.

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
