BEGIN;

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
  v_material_change boolean;
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

  v_material_change :=
    (p_new_statement IS NOT NULL AND p_new_statement IS DISTINCT FROM v_prev_statement)
    OR (p_new_classification IS NOT NULL AND p_new_classification IS DISTINCT FROM v_prev_classification)
    OR (p_source_reference IS NOT NULL AND p_source_reference IS DISTINCT FROM (
      SELECT source_reference FROM public.decision_claims WHERE id = p_claim_id
    ));

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
    v_prev_verification_status,
    CASE WHEN v_material_change THEN 'pending' ELSE v_prev_verification_status END,
    p_source_reference, p_reason, v_uid
  );

  UPDATE decision_claims SET
    statement = COALESCE(p_new_statement, statement),
    evidence_classification = COALESCE(p_new_classification, evidence_classification),
    source_reference = COALESCE(p_source_reference, source_reference),
    last_reviewed_at = now(),
    verification_status = CASE WHEN v_material_change THEN 'pending' ELSE verification_status END
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
    'verified_by', verified_by, 'verified_at', verified_at,
    'last_reviewed_at', last_reviewed_at,
    'evidence_refs', evidence_refs, 'assumptions', assumptions
  )), '[]'::jsonb) INTO v_all_claims
  FROM decision_claims WHERE workspace_id = p_workspace_id;

  SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb) INTO v_verified_facts
  FROM jsonb_array_elements(v_all_claims) elem
  WHERE elem->>'evidence_classification' = 'verified_fact'
    AND elem->>'verification_status' = 'verified';

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
    AND verification_status IS DISTINCT FROM 'verified';

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


COMMIT;
