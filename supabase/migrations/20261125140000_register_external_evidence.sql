BEGIN;
CREATE OR REPLACE FUNCTION public.register_external_evidence(p_workspace_id uuid, p_statement text, p_source_kind text, p_source_name text, p_source_reference text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
 v_actor uuid := auth.uid();
 v_id uuid := gen_random_uuid();
 v_code text := 'EXT-' || replace(v_id::text, '-', '');
 v_status text;
BEGIN
 IF v_actor IS NULL OR coalesce(public.get_workspace_role(p_workspace_id,v_actor),'') NOT IN ('owner','admin') THEN
   RAISE EXCEPTION 'Not authorized to register evidence' USING ERRCODE='42501';
 END IF;
 IF p_statement IS NULL OR char_length(btrim(p_statement)) NOT BETWEEN 1 AND 10000
 OR p_source_kind IS NULL OR p_source_kind NOT IN ('external_ai','human','research','business_data','other')
 OR char_length(coalesce(p_source_name,'')) > 200 OR char_length(coalesce(p_source_reference,'')) > 2000 THEN
   RAISE EXCEPTION 'Invalid evidence input' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.decision_lifecycles(workspace_id) VALUES(p_workspace_id) ON CONFLICT(workspace_id) DO NOTHING;
 SELECT status INTO v_status FROM public.decision_lifecycles WHERE workspace_id=p_workspace_id FOR UPDATE;
 IF v_status IS DISTINCT FROM 'draft' THEN RAISE EXCEPTION 'Reopen the decision as a draft before registering evidence'; END IF;
 INSERT INTO public.decision_claims(id,workspace_id,claim_code,agent_role,agent_name,statement,claim_type,evidence_refs,assumptions,confidence,validity_period_days,evidence_classification,verification_status,source_name,source_reference,supporting_notes)
 VALUES(v_id,p_workspace_id,v_code,'external','External submission',btrim(p_statement),'opinion','[]','[]',0,30,'unverified_claim','not_verified',nullif(btrim(p_source_name),''),nullif(btrim(p_source_reference),''),'Self-reported source category: ' || p_source_kind || '. Confidence not assessed.');
 INSERT INTO public.decision_events(workspace_id,event_type,actor_type,actor_id,payload)
 VALUES(p_workspace_id,'evidence_added','user',v_actor::text,jsonb_build_object('action','external_evidence_registered','claim_id',v_id,'claim_code',v_code,'evidence_statement',btrim(p_statement),'source_kind',p_source_kind,'source_name',nullif(btrim(p_source_name),''),'source_reference',nullif(btrim(p_source_reference),''),'verification_status','not_verified'));
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.register_external_evidence(uuid,text,text,text,text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.register_external_evidence(uuid,text,text,text,text) TO authenticated;
COMMIT;
