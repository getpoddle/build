-- Phase 1.9A: additive, independent multi-approver engine.
-- Do not alter the existing single-approver RPC or its historical records.
CREATE TABLE public.decision_multi_approvals (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 version_id uuid NOT NULL REFERENCES public.decision_versions(id),
 approval_cycle integer NOT NULL,
 approver_user_id uuid NOT NULL,
 submitted_by uuid NOT NULL,
 submitted_at timestamptz NOT NULL DEFAULT now(),
 approver_name text,
 approver_role text NOT NULL,
 outcome text NOT NULL DEFAULT 'pending' CHECK (outcome IN ('pending','approved','rejected','changes_requested','withdrawn')),
 decided_at timestamptz,
 decided_by uuid,
 decided_by_name text,
 decided_by_role text,
 note text,
 UNIQUE(workspace_id, approval_cycle, approver_user_id),
 CHECK ((outcome = 'pending') = (decided_at IS NULL))
);
CREATE INDEX decision_multi_approvals_lookup ON public.decision_multi_approvals(workspace_id, approval_cycle);
CREATE UNIQUE INDEX decision_multi_one_pending_user ON public.decision_multi_approvals(workspace_id,approver_user_id) WHERE outcome='pending';
ALTER TABLE public.decision_multi_approvals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.decision_multi_approvals FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.decision_multi_approvals TO authenticated;
CREATE POLICY multi_approval_member_read ON public.decision_multi_approvals FOR SELECT TO authenticated
 USING (public.is_workspace_member(workspace_id,auth.uid()));
CREATE FUNCTION public.decision_multi_approval_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF TG_OP = 'DELETE' AND pg_trigger_depth() > 1 THEN RETURN OLD; END IF;
 IF current_setting('poddle.multi_approval_write',true) = 'allowed' AND current_user = 'postgres' THEN
   IF TG_OP='UPDATE' AND (NEW.id,NEW.workspace_id,NEW.version_id,NEW.approval_cycle,NEW.approver_user_id,NEW.submitted_by)
      IS DISTINCT FROM (OLD.id,OLD.workspace_id,OLD.version_id,OLD.approval_cycle,OLD.approver_user_id,OLD.submitted_by) THEN
     RAISE EXCEPTION 'Approval identity cannot be changed';
   END IF;
   RETURN CASE WHEN TG_OP='DELETE' THEN OLD ELSE NEW END;
 END IF;
 RAISE EXCEPTION 'Approval records cannot be modified directly' USING ERRCODE='42501';
END $$;
CREATE TRIGGER decision_multi_guard BEFORE UPDATE OR DELETE ON public.decision_multi_approvals FOR EACH ROW EXECUTE FUNCTION public.decision_multi_approval_guard();

CREATE FUNCTION public.decision_multi_submit(p_workspace_id uuid,p_approvers uuid[],p_note text DEFAULT NULL)
RETURNS public.decision_lifecycles LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_ws public.workspaces%ROWTYPE; v_lc public.decision_lifecycles%ROWTYPE;
 v_role text; v_hash text; v_version uuid; v_num integer; v_cycle integer; v_actor text; v_id uuid; v_count integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='28000'; END IF;
 SELECT * INTO v_ws FROM public.workspaces WHERE id=p_workspace_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decision not found'; END IF;
 v_role:=public.get_workspace_role(p_workspace_id,v_uid);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Not a workspace member' USING ERRCODE='42501'; END IF;
 IF NOT (v_role IN ('owner','admin') OR v_uid=v_ws.owner_id OR v_uid=v_ws.decision_owner_override_user_id
  OR EXISTS(SELECT 1 FROM public.domain_owners d WHERE d.workspace_id=p_workspace_id AND d.category_key=v_ws.decision_category
   AND v_uid IN(d.owner_user_id,d.backup_owner_user_id))) THEN
  RAISE EXCEPTION 'Only the decision owner can submit' USING ERRCODE='42501'; END IF;
 IF p_approvers IS NULL OR cardinality(p_approvers)<2 OR cardinality(p_approvers)>30
    OR array_position(p_approvers,NULL) IS NOT NULL OR v_uid=ANY(p_approvers)
    OR (SELECT count(DISTINCT x) FROM unnest(p_approvers) x)<>cardinality(p_approvers) THEN
  RAISE EXCEPTION 'Choose 2–30 distinct independent approvers' USING ERRCODE='22023'; END IF;
 SELECT count(*) INTO v_count FROM public.workspace_members wm
  WHERE wm.workspace_id=p_workspace_id AND wm.user_id=ANY(p_approvers) AND wm.role IN ('owner','admin');
 IF v_count<>cardinality(p_approvers) THEN RAISE EXCEPTION 'All approvers must be workspace owners/admins' USING ERRCODE='42501'; END IF;
 INSERT INTO public.decision_lifecycles(workspace_id) VALUES(p_workspace_id) ON CONFLICT(workspace_id) DO NOTHING;
 SELECT * INTO v_lc FROM public.decision_lifecycles WHERE workspace_id=p_workspace_id FOR UPDATE;
 IF v_lc.status<>'draft' THEN RAISE EXCEPTION 'Only draft decisions can be submitted'; END IF;
 IF v_lc.approval_cycle>0 AND nullif(btrim(coalesce(p_note,'')),'') IS NULL THEN
 RAISE EXCEPTION 'Explain changes before resubmission'; END IF;
 IF EXISTS(SELECT 1 FROM public.decision_multi_approvals WHERE workspace_id=p_workspace_id AND outcome='pending') THEN
 RAISE EXCEPTION 'An approval cycle is already active'; END IF;
 v_hash:=public.decision_material_hash(p_workspace_id);
 SELECT coalesce(max(version_number),0)+1 INTO v_num FROM public.decision_versions WHERE workspace_id=p_workspace_id;
 INSERT INTO public.decision_versions(workspace_id,version_number,content_hash,content,created_by)
 VALUES(p_workspace_id,v_num,v_hash,public.decision_material_content(p_workspace_id),v_uid) RETURNING id INTO v_version;
 v_cycle:=v_lc.approval_cycle+1;
 SELECT full_name INTO v_actor FROM public.profiles WHERE id=v_uid;
 INSERT INTO public.decision_multi_approvals(workspace_id,version_id,approval_cycle,approver_user_id,submitted_by,approver_name,approver_role)
 SELECT p_workspace_id,v_version,v_cycle,wm.user_id,v_uid,pr.full_name,wm.role
 FROM public.workspace_members wm LEFT JOIN public.profiles pr ON pr.id=wm.user_id
 WHERE wm.workspace_id=p_workspace_id AND wm.user_id=ANY(p_approvers);
 UPDATE public.decision_lifecycles SET status='under_review',approver_user_id=NULL,submitted_by=v_uid,submitted_at=now(),
 approval_cycle=v_cycle,current_version_id=v_version,bound_content_hash=v_hash,decided_by=NULL,decided_at=NULL,
 decision_note=NULL,updated_at=now() WHERE workspace_id=p_workspace_id;
 INSERT INTO public.decision_events(workspace_id,event_type,actor_type,actor_id,payload)
 VALUES(p_workspace_id,'approval_submitted','user',v_uid::text,
 jsonb_build_object('approval_method','multi','approval_cycle',v_cycle,'version_id',v_version,'approver_ids',p_approvers));
 SELECT * INTO v_lc FROM public.decision_lifecycles WHERE workspace_id=p_workspace_id;
 RETURN v_lc;
END $$;

CREATE FUNCTION public.decision_multi_action(p_workspace_id uuid,p_action text,p_note text DEFAULT NULL)
RETURNS public.decision_lifecycles LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_uid uuid:=auth.uid(); v_ws public.workspaces%ROWTYPE; v_lc public.decision_lifecycles%ROWTYPE;
 v_req public.decision_multi_approvals%ROWTYPE; v_role text; v_actor text; v_outcome text; v_remaining integer;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION 'Sign in required' USING ERRCODE='28000'; END IF;
 SELECT * INTO v_ws FROM public.workspaces WHERE id=p_workspace_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Decision not found'; END IF;
 v_role:=public.get_workspace_role(p_workspace_id,v_uid);
 IF v_role IS NULL THEN RAISE EXCEPTION 'Not a member' USING ERRCODE='42501'; END IF;
 SELECT * INTO v_lc FROM public.decision_lifecycles WHERE workspace_id=p_workspace_id FOR UPDATE;
 IF v_lc.status<>'under_review' OR v_lc.approver_user_id IS NOT NULL THEN RAISE EXCEPTION 'No active multi-approval cycle'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.decision_multi_approvals WHERE workspace_id=p_workspace_id AND approval_cycle=v_lc.approval_cycle) THEN
 RAISE EXCEPTION 'Multi-approval cycle not found'; END IF;
 IF public.decision_material_hash(p_workspace_id) IS DISTINCT FROM v_lc.bound_content_hash THEN
 RAISE EXCEPTION 'Decision changed since submission. Withdraw and resubmit the new version.'; END IF;
 SELECT full_name INTO v_actor FROM public.profiles WHERE id=v_uid;
 IF p_action='withdraw' THEN
  IF NOT (v_role IN ('owner','admin') OR v_uid=v_ws.owner_id OR v_uid=v_ws.decision_owner_override_user_id
    OR EXISTS(SELECT 1 FROM public.domain_owners d WHERE d.workspace_id=p_workspace_id AND d.category_key=v_ws.decision_category AND v_uid IN(d.owner_user_id,d.backup_owner_user_id))) THEN
   RAISE EXCEPTION 'Only decision owners may withdraw' USING ERRCODE='42501'; END IF;
  PERFORM set_config('poddle.multi_approval_write','allowed',true);
  UPDATE public.decision_multi_approvals SET outcome='withdrawn',decided_at=now(),decided_by=v_uid,decided_by_name=v_actor,
   decided_by_role=v_role,note=p_note WHERE workspace_id=p_workspace_id AND approval_cycle=v_lc.approval_cycle AND outcome='pending';
  UPDATE public.decision_lifecycles SET status='draft',decision_note=p_note,updated_at=now() WHERE workspace_id=p_workspace_id;
 ELSE
  IF p_action NOT IN ('approve','reject','request_changes') THEN RAISE EXCEPTION 'Invalid action'; END IF;
  IF v_role NOT IN ('owner','admin') THEN RAISE EXCEPTION 'Approver must retain owner/admin access' USING ERRCODE='42501'; END IF;
  SELECT * INTO v_req FROM public.decision_multi_approvals WHERE workspace_id=p_workspace_id AND approval_cycle=v_lc.approval_cycle
    AND approver_user_id=v_uid AND outcome='pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'No pending approval assigned to you' USING ERRCODE='42501'; END IF;
  IF p_action<>'approve' AND nullif(btrim(coalesce(p_note,'')),'') IS NULL THEN RAISE EXCEPTION 'Reason required'; END IF;
  v_outcome:=CASE p_action WHEN 'approve' THEN 'approved' WHEN 'reject' THEN 'rejected' ELSE 'changes_requested' END;
  -- 'approve' -> 'approved', 'reject' -> 'rejected'
  PERFORM set_config('poddle.multi_approval_write','allowed',true);
  UPDATE public.decision_multi_approvals SET outcome=v_outcome,decided_at=now(),decided_by=v_uid,
    decided_by_name=v_actor,decided_by_role=v_role,note=p_note WHERE id=v_req.id;
  IF p_action<>'approve' THEN
   UPDATE public.decision_multi_approvals SET outcome='withdrawn',decided_at=now(),decided_by=v_uid,
    decided_by_name=v_actor,decided_by_role=v_role,note='Cycle closed by '||p_action
    WHERE workspace_id=p_workspace_id AND approval_cycle=v_lc.approval_cycle AND outcome='pending';
   UPDATE public.decision_lifecycles SET status=CASE WHEN p_action='reject' THEN 'rejected' ELSE 'draft' END,
    decided_by=v_uid,decided_at=now(),decision_note=p_note,
    revision_count=revision_count+CASE WHEN p_action='request_changes' THEN 1 ELSE 0 END,updated_at=now()
    WHERE workspace_id=p_workspace_id;
  ELSE
   SELECT count(*) INTO v_remaining FROM public.decision_multi_approvals WHERE workspace_id=p_workspace_id
    AND approval_cycle=v_lc.approval_cycle AND outcome='pending';
   IF v_remaining=0 THEN
    UPDATE public.decision_lifecycles SET status='approved',decided_by=v_uid,decided_at=now(),decision_note=p_note,updated_at=now()
    WHERE workspace_id=p_workspace_id;
   END IF;
  END IF;
 END IF;
 INSERT INTO public.decision_events(workspace_id,event_type,actor_type,actor_id,payload)
 VALUES(p_workspace_id, CASE p_action WHEN 'approve' THEN 'approval_approved' WHEN 'reject' THEN 'approval_rejected'
 WHEN 'request_changes' THEN 'approval_changes_requested' ELSE 'approval_withdrawn' END,
 'user',v_uid::text,jsonb_build_object('approval_method','multi','approval_cycle',v_lc.approval_cycle,
 'individual_action',p_action,'final_status',(SELECT status FROM public.decision_lifecycles WHERE workspace_id=p_workspace_id),
 'note',p_note));
 SELECT * INTO v_lc FROM public.decision_lifecycles WHERE workspace_id=p_workspace_id;
 RETURN v_lc;
END $$;
REVOKE ALL ON FUNCTION public.decision_multi_submit(uuid,uuid[],text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.decision_multi_action(uuid,text,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.decision_multi_submit(uuid,uuid[],text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decision_multi_action(uuid,text,text) TO authenticated;

-- Prevent legacy single-approver actions from changing an active multi-approver lifecycle.
CREATE FUNCTION public.decision_multi_lifecycle_guard() RETURNS trigger LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
 IF OLD.status='under_review' AND OLD.approver_user_id IS NULL
   AND (NEW.status IS DISTINCT FROM OLD.status OR NEW.current_version_id IS DISTINCT FROM OLD.current_version_id)
   AND EXISTS(SELECT 1 FROM public.decision_multi_approvals m WHERE m.workspace_id=OLD.workspace_id
      AND m.approval_cycle=OLD.approval_cycle AND m.outcome='pending')
   AND current_setting('poddle.multi_approval_write',true) IS DISTINCT FROM 'allowed' THEN
   RAISE EXCEPTION 'Use the multi-approver workflow to change this decision';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER decision_multi_lifecycle_guard BEFORE UPDATE ON public.decision_lifecycles
 FOR EACH ROW EXECUTE FUNCTION public.decision_multi_lifecycle_guard();
