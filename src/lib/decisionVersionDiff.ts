export interface DecisionVersionClaim {
  claim_code: string | null;
  statement: string | null;
  claim_type: string | null;
  assumptions: unknown;
  confidence: unknown;
  verification_status: string | null;
  evidence_classification: string | null;
  source_reference: string | null;
  verification_method?: string | null;
  source_name?: string | null;
  supporting_document_ref?: string | null;
  supporting_notes?: string | null;
  validity_period_days?: number | null;
  evidence_basis?: string | null;
  evidence_sha256: string[];
}

export interface DecisionVersionRecommendation {
  recommendation: string | null;
  executive_summary: string | null;
}

export interface DecisionVersionCommitment {
  description: string;
  amount: string;
  currency: string;
  assumptions: string;
}

export interface DecisionVersionContent {
  workspace: Record<string, string | null> | null;
  recommendation?: DecisionVersionRecommendation | null;
  financial_commitments?: DecisionVersionCommitment[];
  claims: DecisionVersionClaim[];
}

const WORKSPACE_FIELD_LABELS: Record<string, string> = {
  name: 'Decision name',
  description: 'Description',
  decision_status: 'Decision status',
  decision_category: 'Category',
  domain: 'Domain',
};

const RECOMMENDATION_FIELD_LABELS: Record<string, string> = {
  recommendation: 'AI recommendation',
  executive_summary: 'AI executive summary',
};

const CLAIM_FIELD_LABELS: Record<string, string> = {
  statement: 'statement',
  claim_type: 'type',
  assumptions: 'assumptions',
  confidence: 'confidence',
  verification_status: 'verification status',
  verification_method: 'verification method',
  evidence_classification: 'evidence classification',
  source_name: 'source name',
  source_reference: 'source reference',
  supporting_document_ref: 'supporting document',
  supporting_notes: 'supporting notes',
  validity_period_days: 'validity period',
  evidence_basis: 'evidence basis',
  evidence_sha256: 'linked evidence',
};

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}

function claimKey(claim: DecisionVersionClaim, index: number): string {
  return claim.claim_code ?? `#${index + 1}`;
}

function claimLabel(claim: DecisionVersionClaim, index: number): string {
  return `Claim ${claimKey(claim, index)}`;
}

export function describeVersionChanges(
  before: DecisionVersionContent,
  after: DecisionVersionContent,
): string[] {
  const changes: string[] = [];

  const beforeWs = before.workspace ?? {};
  const afterWs = after.workspace ?? {};
  for (const [field, label] of Object.entries(WORKSPACE_FIELD_LABELS)) {
    if (!sameValue(beforeWs[field], afterWs[field])) {
      changes.push(`${label} changed`);
    }
  }

  const emptyRec: DecisionVersionRecommendation = { recommendation: null, executive_summary: null };
  const beforeRec = before.recommendation ?? emptyRec;
  const afterRec = after.recommendation ?? emptyRec;
  for (const [field, label] of Object.entries(RECOMMENDATION_FIELD_LABELS)) {
    if (!sameValue(beforeRec[field as keyof DecisionVersionRecommendation], afterRec[field as keyof DecisionVersionRecommendation])) {
      changes.push(`${label} changed`);
    }
  }

  if (!sameValue(before.financial_commitments ?? [], after.financial_commitments ?? [])) {
    changes.push('Financial commitments changed');
  }

  const beforeByKey = new Map(before.claims.map((c, i) => [claimKey(c, i), c]));
  const afterKeys = new Set<string>();

  after.claims.forEach((claim, index) => {
    const key = claimKey(claim, index);
    afterKeys.add(key);
    const previous = beforeByKey.get(key);
    if (!previous) {
      changes.push(`${claimLabel(claim, index)} added`);
      return;
    }
    const changedFields = Object.entries(CLAIM_FIELD_LABELS)
      .filter(([field]) => !sameValue(previous[field as keyof DecisionVersionClaim], claim[field as keyof DecisionVersionClaim]))
      .map(([, label]) => label);
    if (changedFields.length > 0) {
      changes.push(`${claimLabel(claim, index)} changed (${changedFields.join(', ')})`);
    }
  });

  before.claims.forEach((claim, index) => {
    if (!afterKeys.has(claimKey(claim, index))) {
      changes.push(`${claimLabel(claim, index)} removed`);
    }
  });

  return changes;
}
