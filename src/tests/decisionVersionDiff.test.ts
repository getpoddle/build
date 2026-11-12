import { describe, it, expect } from 'vitest';
import { describeVersionChanges, type DecisionVersionClaim, type DecisionVersionContent } from '../lib/decisionVersionDiff';

const workspace = {
  name: 'Expand to Germany',
  description: 'Enter the German market in 2027',
  decision_status: 'open',
  decision_category: 'growth',
  domain: 'strategy',
};

function claim(overrides: Partial<DecisionVersionClaim> = {}): DecisionVersionClaim {
  return {
    claim_code: 'C1',
    statement: 'Demand is growing 12% a year',
    claim_type: 'market',
    assumptions: ['stable FX rates'],
    confidence: 0.7,
    verification_status: 'unverified',
    evidence_classification: 'internal',
    source_reference: null,
    evidence_sha256: ['abc'],
    ...overrides,
  };
}

function version(claims: DecisionVersionClaim[], ws: Record<string, string | null> = workspace): DecisionVersionContent {
  return { workspace: ws, claims };
}

describe('describeVersionChanges', () => {
  it('reports no changes for identical content', () => {
    expect(describeVersionChanges(version([claim()]), version([claim()]))).toEqual([]);
  });

  it('reports a changed claim statement by claim code and field', () => {
    const changes = describeVersionChanges(
      version([claim()]),
      version([claim({ statement: 'Demand is growing 9% a year' })]),
    );
    expect(changes).toEqual(['Claim C1 changed (statement)']);
  });

  it('reports multiple changed fields on one claim', () => {
    const changes = describeVersionChanges(
      version([claim()]),
      version([claim({ confidence: 0.4, verification_status: 'verified' })]),
    );
    expect(changes).toEqual(['Claim C1 changed (confidence, verification status)']);
  });

  it('reports added and removed claims', () => {
    const changes = describeVersionChanges(
      version([claim({ claim_code: 'C1' })]),
      version([claim({ claim_code: 'C2' })]),
    );
    expect(changes).toEqual(['Claim C2 added', 'Claim C1 removed']);
  });

  it('detects linked evidence changes', () => {
    const changes = describeVersionChanges(
      version([claim()]),
      version([claim({ evidence_sha256: ['abc', 'def'] })]),
    );
    expect(changes).toEqual(['Claim C1 changed (linked evidence)']);
  });

  it('reports changed decision fields', () => {
    const changes = describeVersionChanges(
      version([], workspace),
      version([], { ...workspace, description: 'Enter Germany in 2028' }),
    );
    expect(changes).toEqual(['Description changed']);
  });

  it('treats a missing workspace snapshot as empty', () => {
    const changes = describeVersionChanges(
      { workspace: null, claims: [] },
      version([], workspace),
    );
    expect(changes).toContain('Decision name changed');
  });

  it('identifies claims without a code by position', () => {
    const changes = describeVersionChanges(
      version([claim({ claim_code: null, statement: 'old' })]),
      version([claim({ claim_code: null, statement: 'new' })]),
    );
    expect(changes).toEqual(['Claim #1 changed (statement)']);
  });
});
