BEGIN;
ALTER TABLE public.workspaces
 ADD COLUMN decision_origin text,
 ADD COLUMN decision_origin_model text;
ALTER TABLE public.workspaces ADD CONSTRAINT workspace_decision_origin_valid CHECK (
 (decision_origin IS NULL AND decision_origin_model IS NULL) OR
 (decision_origin IS NOT NULL AND decision_origin IN ('openai','anthropic','google','microsoft','internal_ai','human','other')
 AND (decision_origin_model IS NULL OR (decision_origin <> 'human' AND char_length(decision_origin_model) BETWEEN 1 AND 200)))
);
CREATE FUNCTION public.guard_external_decision_origin() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN
  IF NEW.decision_origin IS NOT NULL AND current_user <> 'service_role' THEN
   RAISE EXCEPTION 'External decision registration requires the authorized service';
  END IF;
 ELSIF (NEW.decision_origin, NEW.decision_origin_model) IS DISTINCT FROM (OLD.decision_origin, OLD.decision_origin_model) THEN
  RAISE EXCEPTION 'Decision origin is immutable';
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER guard_external_decision_origin BEFORE INSERT OR UPDATE ON public.workspaces
 FOR EACH ROW EXECUTE FUNCTION public.guard_external_decision_origin();
REVOKE ALL ON FUNCTION public.guard_external_decision_origin() FROM PUBLIC, anon, authenticated;
-- Keep existing decision fingerprints unchanged: origin is immutable metadata.
COMMIT;
