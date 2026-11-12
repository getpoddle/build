/*
Approval integrity scenarios (recommendation, financial commitments, evidence, grants).

Run each DO block with the execute_sql tool against a database that has a workspace with two owner/admin members.
Every block ends by raising TEST_RESULTS, which rolls back all changes. Read the returned JSON: each key is one outcome.
Scenarios run in a single session, so they cannot prove concurrent-transaction behavior. The row lock in
decision_invalidate_on_material_change serializes those cases; a two-session check is still required.
*/

DO $test$
DECLARE
  v_ws uuid; v_sub uuid; v_appr uuid; v_st text; v_res jsonb := '{}'::jsonb;
BEGIN
  SELECT m1.workspace_id, m1.user_id, m2.user_id INTO v_ws, v_sub, v_appr
  FROM workspace_members m1
  JOIN workspace_members m2 ON m2.workspace_id = m1.workspace_id AND m2.user_id <> m1.user_id
  WHERE m1.role IN ('owner','admin') AND m2.role IN ('owner','admin') LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'NO_FIXTURE'; END IF;

  INSERT INTO workspace_synthesis (workspace_id, recommendation, executive_summary)
  VALUES (v_ws, 'Approve the pilot with a 90-day review.', 'Summary A')
  ON CONFLICT (workspace_id) DO UPDATE SET recommendation = 'Approve the pilot with a 90-day review.', executive_summary = 'Summary A';

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr);
  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);
  v_res := v_res || jsonb_build_object('r0_approved', (SELECT status = 'approved' FROM decision_lifecycles WHERE workspace_id=v_ws));

  UPDATE workspace_synthesis SET executive_summary = executive_summary WHERE workspace_id = v_ws;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('r1_noop_synthesis_status', v_st);

  UPDATE workspace_synthesis SET recommendation = 'Reject the pilot.' WHERE workspace_id = v_ws;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('r2_recommendation_change_status', v_st,
    'r2_approved_version_keeps_recommendation', (
      SELECT v.content->'recommendation'->>'recommendation'
      FROM decision_approval_requests r JOIN decision_versions v ON v.id = r.version_id
      WHERE r.workspace_id = v_ws AND r.outcome = 'approved' ORDER BY r.approval_cycle DESC LIMIT 1));

  BEGIN PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL); v_res := v_res || '{"r3_approve_after_change":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('r3_approve_after_change_blocked', SQLERRM); END;

  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;

DO $test$
DECLARE
  v_ws uuid; v_sub uuid; v_appr uuid; v_st text; v_res jsonb := '{}'::jsonb;
  v_fc uuid;
BEGIN
  SELECT m1.workspace_id, m1.user_id, m2.user_id INTO v_ws, v_sub, v_appr
  FROM workspace_members m1
  JOIN workspace_members m2 ON m2.workspace_id = m1.workspace_id AND m2.user_id <> m1.user_id
  WHERE m1.role IN ('owner','admin') AND m2.role IN ('owner','admin') LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'NO_FIXTURE'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr);
  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);

  INSERT INTO decision_financial_commitments (workspace_id, description, amount, currency, assumptions, created_by)
  VALUES (v_ws, 'Vendor licence', 12000.00, 'USD', 'Twelve-month term', v_sub) RETURNING id INTO v_fc;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('f1_commitment_insert_status', v_st,
    'f1_approved_request_outcome', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=1));

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'submit','Added licence cost',v_appr);
  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);
  UPDATE decision_financial_commitments SET amount = 15000.00 WHERE id = v_fc;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('f2_amount_change_status', v_st);

  BEGIN INSERT INTO decision_financial_commitments (workspace_id, description, amount, currency) VALUES (v_ws, 'Bad', -1, 'USD');
    v_res := v_res || '{"f3_negative_amount":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('f3_negative_amount_blocked', true); END;
  BEGIN INSERT INTO decision_financial_commitments (workspace_id, description, amount, currency) VALUES (v_ws, 'Bad', 1, 'usd');
    v_res := v_res || '{"f4_lowercase_currency":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('f4_lowercase_currency_blocked', true); END;

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN INSERT INTO decision_financial_commitments (workspace_id, description, amount, currency) VALUES (v_ws, 'Outsider', 1, 'USD');
    v_res := v_res || '{"f5_non_member_insert":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('f5_non_member_insert_blocked', SQLERRM); END;
  RESET ROLE;

  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;

DO $test$
DECLARE
  v_ws uuid; v_sub uuid; v_appr uuid; v_claim uuid; v_st text; v_res jsonb := '{}'::jsonb;
  v_hash_before text; v_hash_after text;
BEGIN
  SELECT m1.workspace_id, m1.user_id, m2.user_id INTO v_ws, v_sub, v_appr
  FROM workspace_members m1
  JOIN workspace_members m2 ON m2.workspace_id = m1.workspace_id AND m2.user_id <> m1.user_id
  WHERE m1.role IN ('owner','admin') AND m2.role IN ('owner','admin')
    AND EXISTS (SELECT 1 FROM decision_claims c WHERE c.workspace_id = m1.workspace_id) LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'NO_FIXTURE'; END IF;
  SELECT id INTO v_claim FROM decision_claims WHERE workspace_id = v_ws LIMIT 1;

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr);
  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);
  v_hash_before := (SELECT content_hash FROM decision_versions WHERE workspace_id = v_ws ORDER BY version_number DESC LIMIT 1);

  UPDATE decision_claims SET verification_method = 'manual review of the contract' WHERE id = v_claim;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('e1_verification_change_status', v_st);

  v_hash_after := (SELECT content_hash FROM decision_versions WHERE workspace_id = v_ws ORDER BY version_number DESC LIMIT 1);
  v_res := v_res || jsonb_build_object('e2_approved_version_hash_unchanged', v_hash_before = v_hash_after);

  BEGIN UPDATE decision_versions SET content = '{}'::jsonb WHERE workspace_id = v_ws;
    v_res := v_res || '{"e3_version_content_edit":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('e3_version_content_edit_blocked', SQLERRM); END;

  v_res := v_res || jsonb_build_object('e4_evidence_basis_present',
    (SELECT jsonb_path_exists(decision_material_content(v_ws), '$.claims[*] ? (@.evidence_basis == "reference_only" || @.evidence_basis == "hashed_files")')));

  PERFORM set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE decision_versions SET content_hash = 'tampered' WHERE workspace_id = v_ws;
    v_res := v_res || '{"u1_outsider_version_tamper":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('u1_outsider_version_tamper_blocked', SQLERRM); END;
  BEGIN PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);
    v_res := v_res || '{"u2_outsider_approve":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('u2_outsider_approve_blocked', SQLERRM); END;
  RESET ROLE;

  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;

DO $test$
DECLARE v_res jsonb := '{}'::jsonb;
BEGIN
  SET LOCAL ROLE anon;
  BEGIN UPDATE workspace_synthesis SET recommendation = 'x';
    v_res := v_res || '{"g1_anon_synthesis_update":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('g1_anon_synthesis_update_blocked', SQLERRM); END;
  RESET ROLE;
  SET LOCAL ROLE authenticated;
  BEGIN UPDATE workspace_synthesis SET recommendation = recommendation WHERE false;
    v_res := v_res || '{"g2_authenticated_synthesis_update_grant":"present"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('g2_authenticated_synthesis_update_grant', SQLERRM); END;
  RESET ROLE;
  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;

DO $test$
DECLARE
  v_ws uuid; v_sub uuid; v_appr uuid; v_outsider uuid := gen_random_uuid();
  v_sub_name_before text; v_appr_role_before text; v_n integer; v_res jsonb := '{}'::jsonb;
BEGIN
  SELECT m1.workspace_id, m1.user_id, m2.user_id INTO v_ws, v_sub, v_appr
  FROM workspace_members m1
  JOIN workspace_members m2 ON m2.workspace_id = m1.workspace_id AND m2.user_id <> m1.user_id
  WHERE m1.role IN ('owner','admin') AND m2.role IN ('owner','admin') LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'NO_FIXTURE'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr);

  v_res := v_res || jsonb_build_object('h1_submit_snapshot_roles_present',
    (SELECT submitted_by_role IS NOT NULL AND approver_role IS NOT NULL
       FROM decision_approval_requests WHERE workspace_id = v_ws AND outcome = 'pending'));

  v_sub_name_before := (SELECT submitted_by_name FROM decision_approval_requests WHERE workspace_id = v_ws AND outcome = 'pending');
  UPDATE profiles SET full_name = 'Renamed During Integrity Test' WHERE id = v_sub;
  v_res := v_res || jsonb_build_object('h2_name_snapshot_unchanged_after_profile_rename',
    (SELECT submitted_by_name IS NOT DISTINCT FROM v_sub_name_before FROM decision_approval_requests WHERE workspace_id = v_ws AND outcome = 'pending'));

  BEGIN UPDATE decision_approval_requests SET submitted_by_name = 'Forged' WHERE workspace_id = v_ws AND outcome = 'pending';
    v_res := v_res || '{"h3_snapshot_forgery":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('h3_snapshot_forgery_blocked', true); END;

  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);
  v_appr_role_before := (SELECT approver_role FROM decision_approval_requests WHERE workspace_id = v_ws AND approval_cycle = 1);

  UPDATE workspace_members SET role = 'member' WHERE workspace_id = v_ws AND user_id = v_appr;
  v_res := v_res || jsonb_build_object('h4_approver_role_snapshot_preserved_after_role_change',
    (SELECT approver_role IS NOT DISTINCT FROM v_appr_role_before FROM decision_approval_requests WHERE workspace_id = v_ws AND approval_cycle = 1));
  UPDATE workspace_members SET role = 'admin' WHERE workspace_id = v_ws AND user_id = v_appr;

  PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
  SET LOCAL ROLE authenticated;
  SELECT count(*) INTO v_n FROM decision_approval_requests WHERE workspace_id = v_ws;
  v_res := v_res || jsonb_build_object('h5_outsider_reads_approval_identities', v_n);
  RESET ROLE;

  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;
