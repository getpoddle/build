/*
Decision version integrity scenarios.

Run with the execute_sql tool against a database that has at least one workspace with two owner/admin members
and at least one claim. Each block ends by raising TEST_RESULTS, which rolls back every change it made.
Read the returned JSON: each key is one scenario outcome.
*/

DO $test$
DECLARE
  v_ws uuid; v_sub uuid; v_appr uuid;
  v_res jsonb := '{}'::jsonb;
  v_n int; v_claim uuid; v_st text; v_h1 text;
BEGIN
  SELECT m1.workspace_id, m1.user_id, m2.user_id INTO v_ws, v_sub, v_appr
  FROM workspace_members m1
  JOIN workspace_members m2 ON m2.workspace_id = m1.workspace_id AND m2.user_id <> m1.user_id
  WHERE m1.role IN ('owner','admin') AND m2.role IN ('owner','admin') LIMIT 1;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'NO_FIXTURE'; END IF;

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  BEGIN PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr); v_res := v_res || '{"s1_submit":"ok"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('s1_submit', SQLERRM); END;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  SELECT content_hash INTO v_h1 FROM decision_versions WHERE workspace_id=v_ws AND version_number=1;
  v_res := v_res || jsonb_build_object('s1_status', v_st, 's1_hash_matches_live', v_h1 = decision_material_hash(v_ws));

  BEGIN PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL); v_res := v_res || '{"s2_non_approver_approve":"ok (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('s2_non_approver_blocked', SQLERRM); END;

  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL);

  UPDATE workspaces SET name = name WHERE id = v_ws;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('s4_noop_update_status', v_st);

  UPDATE workspaces SET description = COALESCE(description,'') || ' [test edit]' WHERE id = v_ws;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('s5_material_edit_status', v_st,
    's5_request_still_approved', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=1));

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  BEGIN PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr); v_res := v_res || '{"s6_resubmit_no_note":"ok (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('s6_resubmit_no_note', SQLERRM); END;
  PERFORM decision_lifecycle_action(v_ws,'submit','Updated the description wording',v_appr);

  UPDATE workspaces SET description = replace(description, ' [test edit]', '') WHERE id = v_ws;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('s7_edit_while_pending_status', v_st,
    's7_cycle2_outcome', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=2));

  BEGIN UPDATE decision_versions SET content_hash='tampered' WHERE workspace_id=v_ws;
    v_res := v_res || '{"s8_version_tamper":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('s8_version_tamper_blocked', SQLERRM); END;
  BEGIN DELETE FROM decision_approval_requests WHERE workspace_id=v_ws;
    v_res := v_res || '{"s10_history_delete":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('s10_history_delete_blocked', SQLERRM); END;

  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  BEGIN PERFORM decision_lifecycle_action(v_ws,'approve',NULL,NULL); v_res := v_res || '{"s11_approve_draft":"allowed (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('s11_approve_draft_blocked', SQLERRM); END;

  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;

DO $test$
DECLARE
  v_ws uuid; v_sub uuid; v_appr uuid; v_claim uuid; v_st text;
  v_res jsonb := '{}'::jsonb;
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
  PERFORM decision_lifecycle_action(v_ws,'reject','Evidence is too thin',NULL);
  v_res := v_res || jsonb_build_object('reject_status', (SELECT status FROM decision_lifecycles WHERE workspace_id=v_ws),
    'reject_outcome', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=1));

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'reopen',NULL,NULL);
  BEGIN PERFORM decision_lifecycle_action(v_ws,'submit',NULL,v_appr); v_res := v_res || '{"resubmit_no_note":"ok (unexpected)"}';
  EXCEPTION WHEN OTHERS THEN v_res := v_res || jsonb_build_object('resubmit_no_note', SQLERRM); END;
  PERFORM decision_lifecycle_action(v_ws,'submit','Added evidence to the claim',v_appr);
  PERFORM set_config('request.jwt.claim.sub', v_appr::text, true);
  PERFORM decision_lifecycle_action(v_ws,'request_changes','Clarify the claim',NULL);
  v_res := v_res || jsonb_build_object('changes_status', (SELECT status FROM decision_lifecycles WHERE workspace_id=v_ws),
    'changes_outcome', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=2));

  PERFORM set_config('request.jwt.claim.sub', v_sub::text, true);
  PERFORM decision_lifecycle_action(v_ws,'submit','Clarified the claim',v_appr);
  PERFORM decision_lifecycle_action(v_ws,'withdraw','Pulling it back',NULL);
  v_res := v_res || jsonb_build_object('withdraw_status', (SELECT status FROM decision_lifecycles WHERE workspace_id=v_ws),
    'withdraw_outcome', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=3));

  PERFORM decision_lifecycle_action(v_ws,'submit','Clarified the claim again',v_appr);
  UPDATE decision_claims SET statement = statement || ' (edited)' WHERE id = v_claim;
  SELECT status INTO v_st FROM decision_lifecycles WHERE workspace_id=v_ws;
  v_res := v_res || jsonb_build_object('claim_edit_status', v_st,
    'claim_edit_cycle4_outcome', (SELECT outcome FROM decision_approval_requests WHERE workspace_id=v_ws AND approval_cycle=4));

  RAISE EXCEPTION 'TEST_RESULTS %', v_res::text;
END;
$test$;
