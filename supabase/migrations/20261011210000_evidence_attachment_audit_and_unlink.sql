BEGIN;
ALTER TABLE public.decision_events DROP CONSTRAINT IF EXISTS decision_events_event_type_check;
ALTER TABLE public.decision_events ADD CONSTRAINT decision_events_event_type_check
CHECK (event_type = ANY (ARRAY[
'decision_created','evidence_added','agent_analysis','challenge_raised',
'human_override','final_decision','outcome_logged','team_note',
'evidence_revised','evidence_verified','snapshot_created','evidence_unlinked'
]));

CREATE OR REPLACE FUNCTION public.log_decision_evidence_link() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_name text; v_code text;
BEGIN
 SELECT original_name INTO v_name FROM public.decision_evidence_files WHERE id=NEW.evidence_file_id;
 SELECT claim_code INTO v_code FROM public.decision_claims WHERE id=NEW.claim_id;
 INSERT INTO public.decision_events(workspace_id,event_type,actor_type,actor_id,payload)
 VALUES (NEW.workspace_id,'evidence_added','user',NEW.linked_by,
 jsonb_build_object('action','file_attached','claim_id',NEW.claim_id,'claim_code',v_code,
 'evidence_file_id',NEW.evidence_file_id,'file_name',v_name));
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS npi_evidence_link_audit ON public.decision_claim_evidence;
CREATE TRIGGER npi_evidence_link_audit AFTER INSERT ON public.decision_claim_evidence
FOR EACH ROW EXECUTE FUNCTION public.log_decision_evidence_link();

CREATE OR REPLACE FUNCTION public.unlink_decision_evidence_file(
 p_claim_id uuid, p_evidence_file_id uuid
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_workspace uuid; v_name text; v_code text; v_count integer;
BEGIN
 SELECT workspace_id,claim_code INTO v_workspace,v_code
 FROM public.decision_claims WHERE id=p_claim_id;
 IF v_workspace IS NULL OR auth.uid() IS NULL
 OR NOT public.can_verify_evidence(v_workspace,auth.uid()) THEN
  RAISE EXCEPTION 'Not authorized to unlink claim evidence';
 END IF;
 SELECT f.original_name INTO v_name FROM public.decision_evidence_files f
 JOIN public.decision_claim_evidence l ON l.evidence_file_id=f.id
 WHERE l.claim_id=p_claim_id AND l.evidence_file_id=p_evidence_file_id
 AND l.workspace_id=v_workspace;
 IF NOT FOUND THEN RAISE EXCEPTION 'Evidence attachment not found'; END IF;
 DELETE FROM public.decision_claim_evidence
 WHERE claim_id=p_claim_id AND evidence_file_id=p_evidence_file_id
 AND workspace_id=v_workspace;
 GET DIAGNOSTICS v_count=ROW_COUNT;
 IF v_count<>1 THEN RAISE EXCEPTION 'Could not unlink evidence'; END IF;
 INSERT INTO public.decision_events(workspace_id,event_type,actor_type,actor_id,payload)
 VALUES(v_workspace,'evidence_unlinked','user',auth.uid(),
 jsonb_build_object('action','file_unlinked','claim_id',p_claim_id,
 'claim_code',v_code,'evidence_file_id',p_evidence_file_id,'file_name',v_name));
END $$;
REVOKE ALL ON FUNCTION public.unlink_decision_evidence_file(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.unlink_decision_evidence_file(uuid,uuid) TO authenticated;
COMMIT;
