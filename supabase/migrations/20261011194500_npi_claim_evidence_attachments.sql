BEGIN;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('decision-evidence', 'decision-evidence', false, 10485760,
  ARRAY['application/pdf','text/csv','application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'image/png','image/jpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.decision_evidence_files (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 storage_path text NOT NULL UNIQUE,
 original_name text NOT NULL,
 mime_type text NOT NULL,
 size_bytes bigint NOT NULL CHECK (size_bytes > 0 AND size_bytes <= 10485760),
 sha256_hex text NOT NULL CHECK (sha256_hex ~ '^[0-9a-f]{64}$'),
 source_reference text,
 uploaded_by uuid NOT NULL REFERENCES auth.users(id),
 uploaded_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE (id, workspace_id),
 CHECK (storage_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/[0-9a-f-]{36}\.[a-z0-9]+$')
);
CREATE TABLE IF NOT EXISTS public.decision_claim_evidence (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 claim_id uuid NOT NULL REFERENCES public.decision_claims(id) ON DELETE CASCADE,
 evidence_file_id uuid NOT NULL REFERENCES public.decision_evidence_files(id) ON DELETE RESTRICT,
 workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
 linked_by uuid NOT NULL REFERENCES auth.users(id),
 linked_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(claim_id, evidence_file_id),
 FOREIGN KEY (evidence_file_id, workspace_id)
 REFERENCES public.decision_evidence_files(id, workspace_id)
);

ALTER TABLE public.decision_evidence_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decision_claim_evidence ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.decision_evidence_files, public.decision_claim_evidence FROM anon, authenticated;
GRANT SELECT ON public.decision_evidence_files, public.decision_claim_evidence TO authenticated;

DROP POLICY IF EXISTS npi_evidence_files_read ON public.decision_evidence_files;
CREATE POLICY npi_evidence_files_read ON public.decision_evidence_files
 FOR SELECT TO authenticated
 USING (public.is_workspace_member(workspace_id, auth.uid()));
DROP POLICY IF EXISTS npi_claim_evidence_read ON public.decision_claim_evidence;
CREATE POLICY npi_claim_evidence_read ON public.decision_claim_evidence
 FOR SELECT TO authenticated
 USING (public.is_workspace_member(workspace_id, auth.uid()));

-- Storage: private reads require registered evidence and workspace membership.
-- Uploads are scoped to workspace/user UUID path. No client update/delete policies.
DROP POLICY IF EXISTS npi_evidence_storage_read ON storage.objects;
CREATE POLICY npi_evidence_storage_read ON storage.objects
 FOR SELECT TO authenticated USING (
 bucket_id = 'decision-evidence'
 AND EXISTS (
   SELECT 1 FROM public.decision_evidence_files f
   WHERE f.storage_path = name
     AND public.is_workspace_member(f.workspace_id, auth.uid())
 )
);
DROP POLICY IF EXISTS npi_evidence_storage_upload ON storage.objects;
CREATE POLICY npi_evidence_storage_upload ON storage.objects
 FOR INSERT TO authenticated WITH CHECK (
 bucket_id = 'decision-evidence'
 AND (storage.foldername(name))[2] = auth.uid()::text
 AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
 AND public.is_workspace_member(((storage.foldername(name))[1])::uuid, auth.uid())
);

CREATE OR REPLACE FUNCTION public.register_decision_evidence_file(
 p_workspace_id uuid, p_storage_path text, p_original_name text,
 p_mime_type text, p_size_bytes bigint, p_sha256_hex text,
 p_source_reference text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid; v_obj storage.objects%ROWTYPE;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_workspace_member(p_workspace_id, auth.uid()) THEN
  RAISE EXCEPTION 'Not authorized for workspace';
 END IF;
 IF p_storage_path !~ ('^' || p_workspace_id::text || '/' || auth.uid()::text ||
                       '/[0-9a-f-]{36}\.[a-z0-9]+$') THEN
  RAISE EXCEPTION 'Invalid evidence path';
 END IF;
 SELECT * INTO v_obj FROM storage.objects
 WHERE bucket_id='decision-evidence' AND name=p_storage_path;
 IF NOT FOUND THEN RAISE EXCEPTION 'Upload not found'; END IF;
 IF length(trim(coalesce(p_original_name,'')))=0 OR p_size_bytes <= 0
    OR p_size_bytes > 10485760 OR p_sha256_hex !~ '^[0-9a-f]{64}$' THEN
  RAISE EXCEPTION 'Invalid file metadata';
 END IF;
 IF p_mime_type NOT IN ('application/pdf','text/csv','application/vnd.ms-excel',
 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
 'image/png','image/jpeg') THEN RAISE EXCEPTION 'Unsupported file type'; END IF;
 INSERT INTO public.decision_evidence_files
 (workspace_id,storage_path,original_name,mime_type,size_bytes,sha256_hex,source_reference,uploaded_by)
 VALUES (p_workspace_id,p_storage_path,p_original_name,p_mime_type,p_size_bytes,
         p_sha256_hex,p_source_reference,auth.uid()) RETURNING id INTO v_id;
 RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION public.link_decision_evidence_file(
 p_claim_id uuid, p_evidence_file_id uuid
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_workspace uuid; v_file_workspace uuid; v_id uuid;
BEGIN
 SELECT workspace_id INTO v_workspace FROM public.decision_claims WHERE id=p_claim_id;
 SELECT workspace_id INTO v_file_workspace FROM public.decision_evidence_files WHERE id=p_evidence_file_id;
 IF v_workspace IS NULL OR v_file_workspace IS DISTINCT FROM v_workspace OR auth.uid() IS NULL
    OR NOT public.can_verify_evidence(v_workspace, auth.uid()) THEN
  RAISE EXCEPTION 'Not authorized or workspace mismatch';
 END IF;
 INSERT INTO public.decision_claim_evidence(claim_id,evidence_file_id,workspace_id,linked_by)
 VALUES (p_claim_id,p_evidence_file_id,v_workspace,auth.uid())
 ON CONFLICT (claim_id,evidence_file_id) DO UPDATE
 SET evidence_file_id=EXCLUDED.evidence_file_id
 RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.register_decision_evidence_file(uuid,text,text,text,bigint,text,text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.link_decision_evidence_file(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.register_decision_evidence_file(uuid,text,text,text,bigint,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_decision_evidence_file(uuid,uuid) TO authenticated;
COMMIT;
