/*
# Bind AI recommendation, financial commitments, and evidence basis into approvals

1. New Tables
- `decision_financial_commitments`: optional financial commitments attached to a decision.
  Columns: id, workspace_id, description, amount (numeric, 2 decimals, >= 0), currency (ISO 4217 three-letter code), assumptions, created_by, created_at.
  Empty by default. Nothing is created automatically.

2. Modified Functions
- `decision_material_content`: the approval fingerprint now also covers:
  - The AI recommendation and executive summary from `workspace_synthesis`.
  - All financial commitments (description, amount, currency, assumptions).
  - Additional claim fields: verification method, verified at, verified by, source name, supporting document reference, supporting notes, validity period, evidence references, agent name and role.
  - Each linked evidence file contributes its SHA-256 hash. A file without a hash contributes a marker so its absence still changes the fingerprint.
  - Each claim reports its evidence basis: `hashed_files` when linked files exist, `reference_only` when the claim only cites an external source.

3. Triggers
- Commitments: insert, update, and delete invalidate pending or approved decisions.
- `workspace_synthesis`: insert, delete, and updates to recommendation or executive summary invalidate pending or approved decisions.
- `decision_claims`: the list of material columns that invalidate approvals is extended to match the fingerprint.

4. Security
- `decision_financial_commitments` has RLS enabled.
- Members can read commitments. Only owners and admins can add, edit, or remove them.
- Grants: SELECT to authenticated; INSERT on workspace_id, description, amount, currency, assumptions; UPDATE on description, amount, currency, assumptions; DELETE to authenticated. No anon access.

5. Important Notes
- Approved versions stored before this migration keep their original fingerprints. The first fingerprint check after this migration compares against the new content and may mark an approved decision as changed. Approvers must then re-approve, which is the intended effect for the newly bound content.
- Financial figures are never generated here. The AI financial metrics stay unbound because they are estimates, not commitments.
*/

CREATE TABLE IF NOT EXISTS decision_financial_commitments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  description text NOT NULL CHECK (char_length(btrim(description)) BETWEEN 1 AND 500),
  amount numeric(18,2) NOT NULL CHECK (amount >= 0),
  currency text NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  assumptions text NOT NULL DEFAULT '' CHECK (char_length(assumptions) <= 2000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS decision_financial_commitments_workspace_idx
  ON decision_financial_commitments (workspace_id);

ALTER TABLE decision_financial_commitments ENABLE ROW LEVEL SECURITY;

GRANT SELECT ON decision_financial_commitments TO authenticated;
GRANT INSERT (workspace_id, description, amount, currency, assumptions) ON decision_financial_commitments TO authenticated;
GRANT UPDATE (description, amount, currency, assumptions) ON decision_financial_commitments TO authenticated;
GRANT DELETE ON decision_financial_commitments TO authenticated;

DROP POLICY IF EXISTS "select_workspace_financial_commitments" ON decision_financial_commitments;
CREATE POLICY "select_workspace_financial_commitments" ON decision_financial_commitments FOR SELECT
  TO authenticated USING (is_workspace_member(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "insert_workspace_financial_commitments" ON decision_financial_commitments;
CREATE POLICY "insert_workspace_financial_commitments" ON decision_financial_commitments FOR INSERT
  TO authenticated WITH CHECK (
    is_workspace_admin_or_owner(workspace_id, auth.uid())
    AND (created_by IS NULL OR created_by = auth.uid())
  );

DROP POLICY IF EXISTS "update_workspace_financial_commitments" ON decision_financial_commitments;
CREATE POLICY "update_workspace_financial_commitments" ON decision_financial_commitments FOR UPDATE
  TO authenticated
  USING (is_workspace_admin_or_owner(workspace_id, auth.uid()))
  WITH CHECK (is_workspace_admin_or_owner(workspace_id, auth.uid()));

DROP POLICY IF EXISTS "delete_workspace_financial_commitments" ON decision_financial_commitments;
CREATE POLICY "delete_workspace_financial_commitments" ON decision_financial_commitments FOR DELETE
  TO authenticated USING (is_workspace_admin_or_owner(workspace_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.decision_material_content(p_workspace_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
SELECT jsonb_build_object(
  'workspace', (
    SELECT jsonb_build_object(
      'name', w.name,
      'description', w.description,
      'decision_status', w.decision_status,
      'decision_category', w.decision_category,
      'domain', w.domain
    )
    FROM workspaces w WHERE w.id = p_workspace_id
  ),
  'recommendation', (
    SELECT jsonb_build_object(
      'recommendation', s.recommendation,
      'executive_summary', s.executive_summary
    )
    FROM workspace_synthesis s WHERE s.workspace_id = p_workspace_id
  ),
  'financial_commitments', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'description', fc.description,
        'amount', fc.amount::text,
        'currency', fc.currency,
        'assumptions', fc.assumptions
      )
      ORDER BY fc.created_at, fc.id
    )
    FROM decision_financial_commitments fc
    WHERE fc.workspace_id = p_workspace_id
  ), '[]'::jsonb),
  'claims', COALESCE((
    SELECT jsonb_agg(
      jsonb_build_object(
        'claim_code', c.claim_code,
        'statement', c.statement,
        'claim_type', c.claim_type,
        'assumptions', c.assumptions,
        'confidence', c.confidence,
        'verification_status', c.verification_status,
        'verification_method', c.verification_method,
        'verified_at', c.verified_at,
        'verified_by', c.verified_by,
        'evidence_classification', c.evidence_classification,
        'source_name', c.source_name,
        'source_reference', c.source_reference,
        'supporting_document_ref', c.supporting_document_ref,
        'supporting_notes', c.supporting_notes,
        'validity_period_days', c.validity_period_days,
        'evidence_refs', c.evidence_refs,
        'agent_name', c.agent_name,
        'agent_role', c.agent_role,
        'evidence_basis', CASE
          WHEN EXISTS (SELECT 1 FROM decision_claim_evidence ce WHERE ce.claim_id = c.id)
            THEN 'hashed_files'
          ELSE 'reference_only'
        END,
        'evidence_sha256', COALESCE((
          SELECT jsonb_agg(COALESCE(f.sha256_hex, 'unhashed:' || f.id::text) ORDER BY COALESCE(f.sha256_hex, 'unhashed:' || f.id::text))
          FROM decision_claim_evidence ce
          JOIN decision_evidence_files f ON f.id = ce.evidence_file_id
          WHERE ce.claim_id = c.id
        ), '[]'::jsonb)
      )
      ORDER BY c.claim_code, c.id
    )
    FROM decision_claims c
    WHERE c.workspace_id = p_workspace_id
  ), '[]'::jsonb)
)
$function$;

DROP TRIGGER IF EXISTS decision_material_change_claim_edits ON decision_claims;
CREATE TRIGGER decision_material_change_claim_edits
  AFTER UPDATE OF claim_code, statement, claim_type, assumptions, confidence, verification_status,
    verification_method, verified_at, verified_by, evidence_classification, source_name,
    source_reference, supporting_document_ref, supporting_notes, validity_period_days,
    evidence_refs, agent_name, agent_role
  ON decision_claims
  FOR EACH ROW EXECUTE FUNCTION decision_invalidate_on_material_change();

DROP TRIGGER IF EXISTS decision_material_change_financial_commitments ON decision_financial_commitments;
CREATE TRIGGER decision_material_change_financial_commitments
  AFTER INSERT OR UPDATE OR DELETE ON decision_financial_commitments
  FOR EACH ROW EXECUTE FUNCTION decision_invalidate_on_material_change();

DROP TRIGGER IF EXISTS decision_material_change_synthesis ON workspace_synthesis;
CREATE TRIGGER decision_material_change_synthesis
  AFTER INSERT OR DELETE OR UPDATE OF recommendation, executive_summary ON workspace_synthesis
  FOR EACH ROW EXECUTE FUNCTION decision_invalidate_on_material_change();
