export interface DecisionVersionClaim {
  claim_code: string | null;
  statement: string | null;
  claim_type: string | null;
  assumptions: unknown;
  confidence: unknown;
  verification_status: string | null;
  evidence_classification: string | null;
  source_reference: string | null;
  evidence_sha256: string[];
}

export interface DecisionVersionContent {
  workspace: Record<string, string | null> | null;
  claims: DecisionVersionClaim[];
}

const WORKSPACE_FIELD_LABELS: Record<string, string> = {
  name: 'Decision name',
  description: 'Description',
  decision_status: 'Decision status',
  decision_category: 'Category',
  domain: 'Domain',
};

const CLAIM_FIELD_LABELS: Record<string, string> = {
  statement: 'statement',
  claim_type: 'type',
  assumptions: 'assumptions',
  confidence: 'confidence',
  verification_status: 'verification status',
  evidence_classification: 'evidence classification',
  source_reference: 'source reference',
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
