BEGIN;
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
  v_classification text;
  v_method text := btrim(coalesce(p_verification_method, ''));
  v_source text := btrim(coalesce(p_source_reference, ''));
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  SELECT workspace_id, verification_status, claim_code, statement, evidence_classification
  INTO v_workspace_id, v_prev_status, v_claim_code, v_statement, v_classification
  FROM public.decision_claims WHERE id = p_claim_id FOR UPDATE;

  IF v_workspace_id IS NULL THEN RAISE EXCEPTION 'Claim not found'; END IF;
  IF NOT public.can_verify_evidence(v_workspace_id, v_uid) THEN
    RAISE EXCEPTION 'You are not authorized to verify evidence in this workspace';
  END IF;

  IF length(v_method) < 12 THEN
    RAISE EXCEPTION 'Describe the verification method (at least 12 characters)';
  END IF;
  IF length(v_source) < 12 THEN
    RAISE EXCEPTION 'Provide an identifiable source reference (at least 12 characters)';
  END IF;
  IF lower(v_source) IN (
    'human verified', 'human verification', 'verified by team',
    'from the team', 'team discussion', 'manual review',
    'this is reviewed manually', 'verifying by our team',
    'subject to human', 'subject to human verification',
    'now verified', 'verified manually'
  ) THEN
    RAISE EXCEPTION 'A generic verification statement is not a source. Identify a document, dataset, record, or URL';
  END IF;
  IF lower(v_method) IN ('human verification', 'manual review', 'now verified', 'verified') THEN
    RAISE EXCEPTION 'Describe how the source was checked, not merely that it was verified';
  END IF;

  INSERT INTO public.claim_verification_history (
    claim_id, workspace_id, previous_status, new_status,
    reviewer_id, verification_method, source_reference, notes
  ) VALUES (
    p_claim_id, v_workspace_id, v_prev_status, 'verified',
    v_uid, v_method, v_source, p_notes
  );

  UPDATE public.decision_claims SET
    verification_status = 'verified',
    verification_method = v_method,
    source_reference = v_source,
    verified_by = v_uid,
    verified_at = now(),
    last_verified_at = now(),
    last_reviewed_at = now(),
    supporting_notes = p_notes
  WHERE id = p_claim_id;

  INSERT INTO public.decision_events (workspace_id, event_type, actor_type, actor_id, payload)
  VALUES (
    v_workspace_id, 'team_note', 'user', v_uid::text,
    jsonb_build_object(
      'text', 'Human-reviewed evidence ' || v_claim_code || ': "' || left(v_statement, 80) || '"',
      'verification_method', v_method,
      'source_reference', v_source,
      'evidence_classification', v_classification
    )
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reverify_decision_claim(uuid,text,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reverify_decision_claim(uuid,text,text,text) TO authenticated;
COMMIT;
