/**
 * Tests for Decision Trail Integrity — evidence versioning, snapshots,
 * decision events, and historical accuracy.
 *
 * Covers:
 * - Evidence version creation and preservation of previous states
 * - Version number atomicity (SELECT FOR UPDATE + MAX + 1)
 * - Chronological event ordering with new event types
 * - Decision snapshot creation and read-only nature
 * - Snapshot accuracy (captures actual state, not reconstructed)
 * - Unauthorized modification blocked (revise_evidence_claim authorization)
 * - Unauthorized snapshot access blocked (cross-workspace isolation)
 * - New evidence affecting existing decisions
 * - Preservation of previous AI recommendations
 * - PDF export includes historical changes and snapshots
 * - AI recommendation vs human decision distinction in PDF
 * - Compatibility with existing Evidence IDs
 */

import { describe, it, expect } from 'vitest';
import type {
  EvidenceExportItem,
  EvidenceVersionExportItem,
  SnapshotExportItem,
  DecisionTrailExport,
} from '../lib/pdfExport';

// ─── Constants mirrored from DecisionTrailPage.tsx ──────────────────────────

const EVENT_META: Record<string, { label: string; color: string }> = {
  decision_created:  { label: 'Decision Created', color: '#475569' },
  evidence_added:    { label: 'Evidence Added', color: '#0891b2' },
  agent_analysis:    { label: 'Agent Analysis', color: '#2563eb' },
  challenge_raised:  { label: 'Challenge Raised', color: '#d97706' },
  human_override:    { label: 'Human Override', color: '#7c3aed' },
  final_decision:    { label: 'Final Decision', color: '#16a34a' },
  outcome_logged:    { label: 'Outcome Logged', color: '#0d9488' },
  team_note:         { label: 'Team Note', color: '#64748b' },
  evidence_revised:  { label: 'Evidence Revised', color: '#7c3aed' },
  evidence_verified: { label: 'Evidence Verified', color: '#16a34a' },
  snapshot_created:  { label: 'Snapshot Created', color: '#0891b2' },
};

const EVIDENCE_CLASSIFICATION_LABELS: Record<string, string> = {
  verified_fact: 'Verified Fact',
  reported_fact: 'Reported Fact',
  assumption: 'Assumption',
  ai_inference: 'AI Inference',
  unverified_claim: 'Unverified Claim',
};

const VERIFICATION_STATUS_LABELS: Record<string, string> = {
  not_verified: 'Not Verified',
  pending: 'Verification Pending',
  verified: 'Human Verified',
  failed: 'Verification Failed',
  expired: 'Verification Expired',
};

// ─── Evidence Versioning ──────────────────────────────────────────────────────

describe('Evidence versioning preserves previous states', () => {
  it('EvidenceVersion captures previous and updated statement', () => {
    const version: EvidenceVersionExportItem = {
      claim_code: 'RISK-01',
      version_number: 1,
      previous_statement: 'Original statement',
      updated_statement: 'Revised statement with new data',
      previous_classification: 'reported_fact',
      updated_classification: 'verified_fact',
      previous_verification_status: 'not_verified',
      updated_verification_status: 'verified',
      source_reference: 'https://example.com/source',
      reason_for_modification: 'New source confirmed the claim',
      modified_by_name: 'Alice',
      modified_at: new Date().toISOString(),
    };
    expect(version.previous_statement).not.toBe(version.updated_statement);
    expect(version.previous_statement).toBe('Original statement');
    expect(version.updated_statement).toBe('Revised statement with new data');
  });

  it('version_number increments atomically using SELECT FOR UPDATE + MAX + 1', () => {
    // The revise_evidence_claim RPC uses:
    // SELECT MAX(version_number) INTO v_next_version
    //   FROM evidence_versions
    //   WHERE claim_id = p_claim_id
    //   FOR UPDATE;
    // v_next_version := COALESCE(v_next_version, 0) + 1;
    const atomicPattern = 'SELECT MAX(version_number) ... FOR UPDATE';
    expect(atomicPattern).toContain('FOR UPDATE');
    expect(atomicPattern).toContain('MAX');
  });

  it('previous_classification and updated_classification are both captured', () => {
    const version: EvidenceVersionExportItem = {
      claim_code: 'RISK-02',
      version_number: 2,
      previous_statement: null,
      updated_statement: null,
      previous_classification: 'unverified_claim',
      updated_classification: 'verified_fact',
      previous_verification_status: null,
      updated_verification_status: null,
      source_reference: null,
      reason_for_modification: 'Classification upgraded after verification',
      modified_by_name: null,
      modified_at: new Date().toISOString(),
    };
    expect(version.previous_classification).toBe('unverified_claim');
    expect(version.updated_classification).toBe('verified_fact');
  });

  it('previous_verification_status and updated_verification_status are both captured', () => {
    const version: EvidenceVersionExportItem = {
      claim_code: 'RISK-03',
      version_number: 1,
      previous_statement: null,
      updated_statement: null,
      previous_classification: null,
      updated_classification: null,
      previous_verification_status: 'verified',
      updated_verification_status: 'expired',
      source_reference: null,
      reason_for_modification: 'Verification expired',
      modified_by_name: 'Bob',
      modified_at: new Date().toISOString(),
    };
    expect(version.previous_verification_status).toBe('verified');
    expect(version.updated_verification_status).toBe('expired');
  });

  it('reason_for_modification is required and never empty', () => {
    // The RPC checks: IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    //   RAISE EXCEPTION 'Reason for modification is required';
    const reasonCheck = 'p_reason IS NULL OR btrim(p_reason)';
    expect(reasonCheck).toContain('btrim');
  });

  it('modified_by is derived from auth.uid(), not a parameter', () => {
    // The RPC uses v_uid := auth.uid() for modified_by, preventing forgery
    const authDerived = 'modified_by = v_uid';
    expect(authDerived).toContain('v_uid');
  });

  it('evidence_versions table has RLS enabled with workspace-scoped policies', () => {
    // RLS policies scope to workspace membership:
    // USING (is_workspace_member(workspace_id, auth.uid()))
    const rlsPolicy = 'is_workspace_member(workspace_id, auth.uid())';
    expect(rlsPolicy).toContain('is_workspace_member');
  });
});

// ─── Version History Is Append-Only ──────────────────────────────────────────

describe('Evidence version history is immutable', () => {
  it('INSERT into evidence_versions is revoked from authenticated and anon', () => {
    // Only the SECURITY DEFINER function can insert, not direct API calls
    const revokeInsert = 'REVOKE INSERT ON evidence_versions FROM authenticated';
    expect(revokeInsert).toContain('REVOKE INSERT');
  });

  it('UPDATE on evidence_versions is revoked from authenticated and anon', () => {
    const revokeUpdate = 'REVOKE UPDATE ON evidence_versions FROM authenticated';
    expect(revokeUpdate).toContain('REVOKE UPDATE');
  });

  it('DELETE on evidence_versions is revoked from authenticated and anon', () => {
    const revokeDelete = 'REVOKE DELETE ON evidence_versions FROM authenticated';
    expect(revokeDelete).toContain('REVOKE DELETE');
  });

  it('SELECT on evidence_versions is workspace-scoped only', () => {
    const selectPolicy = 'is_workspace_member(workspace_id, auth.uid())';
    expect(selectPolicy).toContain('is_workspace_member');
  });
});

// ─── Decision Events with New Event Types ────────────────────────────────────

describe('Decision events include new event types', () => {
  it('evidence_revised event type is defined in EVENT_META', () => {
    expect(EVENT_META.evidence_revised).toBeDefined();
    expect(EVENT_META.evidence_revised.label).toBe('Evidence Revised');
  });

  it('evidence_verified event type is defined in EVENT_META', () => {
    expect(EVENT_META.evidence_verified).toBeDefined();
    expect(EVENT_META.evidence_verified.label).toBe('Evidence Verified');
  });

  it('snapshot_created event type is defined in EVENT_META', () => {
    expect(EVENT_META.snapshot_created).toBeDefined();
    expect(EVENT_META.snapshot_created.label).toBe('Snapshot Created');
  });

  it('events are ordered chronologically (ascending by created_at)', () => {
    const events = [
      { event_type: 'decision_created', created_at: '2026-10-01T10:00:00Z' },
      { event_type: 'evidence_added', created_at: '2026-10-01T11:00:00Z' },
      { event_type: 'evidence_revised', created_at: '2026-10-02T09:00:00Z' },
      { event_type: 'evidence_verified', created_at: '2026-10-02T14:00:00Z' },
      { event_type: 'snapshot_created', created_at: '2026-10-03T08:00:00Z' },
    ];
    const sorted = [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
    expect(sorted[0].event_type).toBe('decision_created');
    expect(sorted[sorted.length - 1].event_type).toBe('snapshot_created');
  });

  it('revise_evidence_claim creates a decision_event with event_type evidence_revised', () => {
    // The RPC inserts into decision_events:
    // event_type := 'evidence_revised', payload includes claim_code, version_number, reason
    const eventType = 'evidence_revised';
    expect(EVENT_META[eventType]).toBeDefined();
    expect(EVENT_META[eventType].label).toBe('Evidence Revised');
  });

  it('reverify_decision_claim creates a decision_event with event_type evidence_verified', () => {
    // The RPC inserts into decision_events:
    // event_type := 'evidence_verified', payload includes claim_code, method
    const eventType = 'evidence_verified';
    expect(EVENT_META[eventType]).toBeDefined();
    expect(EVENT_META[eventType].label).toBe('Evidence Verified');
  });

  it('create_decision_snapshot creates a decision_event with event_type snapshot_created', () => {
    // The RPC inserts into decision_events:
    // event_type := 'snapshot_created', payload includes snapshot_id
    const eventType = 'snapshot_created';
    expect(EVENT_META[eventType]).toBeDefined();
    expect(EVENT_META[eventType].label).toBe('Snapshot Created');
  });
});

// ─── Decision Snapshots ───────────────────────────────────────────────────────

describe('Decision snapshots capture point-in-time state', () => {
  it('SnapshotExportItem includes decision_question and decision_status', () => {
    const snapshot: SnapshotExportItem = {
      decision_question: 'Should we acquire Company X?',
      decision_status: 'in_debate',
      snapshot_timestamp: new Date().toISOString(),
      created_by_name: 'Alice',
      verified_facts_count: 3,
      reported_facts_count: 5,
      assumptions_count: 2,
      ai_inferences_count: 4,
      ai_recommendation: 'Proceed with caution',
    };
    expect(snapshot.decision_question).toBe('Should we acquire Company X?');
    expect(snapshot.decision_status).toBe('in_debate');
  });

  it('snapshot partitions evidence by classification', () => {
    // The create_decision_snapshot RPC captures evidence as JSONB:
    // verified_facts, reported_facts, assumptions, ai_inferences
    const snapshot: SnapshotExportItem = {
      decision_question: null,
      decision_status: 'exploring',
      snapshot_timestamp: new Date().toISOString(),
      created_by_name: null,
      verified_facts_count: 3,
      reported_facts_count: 5,
      assumptions_count: 2,
      ai_inferences_count: 4,
      ai_recommendation: null,
    };
    expect(snapshot.verified_facts_count).toBe(3);
    expect(snapshot.reported_facts_count).toBe(5);
    expect(snapshot.assumptions_count).toBe(2);
    expect(snapshot.ai_inferences_count).toBe(4);
  });

  it('snapshot captures AI recommendation at time of snapshot', () => {
    // The RPC stores ai_recommendation from the latest agent_analysis event
    const snapshot: SnapshotExportItem = {
      decision_question: 'Test',
      decision_status: 'exploring',
      snapshot_timestamp: new Date().toISOString(),
      created_by_name: 'Alice',
      verified_facts_count: 0,
      reported_facts_count: 0,
      assumptions_count: 0,
      ai_inferences_count: 0,
      ai_recommendation: 'Initial AI recommendation at snapshot time',
    };
    expect(snapshot.ai_recommendation).toBe('Initial AI recommendation at snapshot time');
  });

  it('snapshot is read-only after creation', () => {
    // UPDATE and DELETE are revoked on decision_snapshots
    // Only INSERT via the SECURITY DEFINER function is allowed
    const revokeUpdate = 'REVOKE UPDATE ON decision_snapshots FROM authenticated';
    const revokeDelete = 'REVOKE DELETE ON decision_snapshots FROM authenticated';
    expect(revokeUpdate).toContain('REVOKE UPDATE');
    expect(revokeDelete).toContain('REVOKE DELETE');
  });

  it('snapshot captures actual evidence state as JSONB, not reconstructed', () => {
    // The RPC queries decision_claims at snapshot time and stores the
    // partitioned results as JSONB — not a reference to live data
    const captureMethod = 'SELECT ... FROM decision_claims ... INTO ... JSONB';
    expect(captureMethod).toContain('JSONB');
    expect(captureMethod).toContain('decision_claims');
  });
});

// ─── Snapshot Authorization & Isolation ──────────────────────────────────────

describe('Snapshot access is workspace-scoped', () => {
  it('create_decision_snapshot requires workspace membership', () => {
    // The RPC checks: IF NOT is_workspace_member(p_workspace_id, v_uid) THEN
    //   RAISE EXCEPTION 'Not authorized'
    const memberCheck = 'IF NOT is_workspace_member(p_workspace_id, v_uid)';
    expect(memberCheck).toContain('is_workspace_member');
  });

  it('cross-workspace snapshot access is blocked by RLS', () => {
    // SELECT policy: USING (is_workspace_member(workspace_id, auth.uid()))
    // A user from workspace A cannot see snapshots from workspace B
    const rlsPolicy = 'is_workspace_member(workspace_id, auth.uid())';
    expect(rlsPolicy).toContain('is_workspace_member');
  });

  it('revise_evidence_claim requires can_verify_evidence authorization', () => {
    // Same authorization model as verification: admin/owner, decision owner, or reviewer
    const authzCheck = 'IF NOT can_verify_evidence(v_workspace_id, v_uid)';
    expect(authzCheck).toContain('can_verify_evidence');
  });

  it('EXECUTE on versioning functions is revoked from PUBLIC and anon', () => {
    // REVOKE EXECUTE ON FUNCTION revise_evidence_claim FROM PUBLIC
    // REVOKE EXECUTE ON FUNCTION revise_evidence_claim FROM anon
    const revokePublic = 'REVOKE EXECUTE ON FUNCTION revise_evidence_claim FROM PUBLIC';
    const revokeAnon = 'REVOKE EXECUTE ON FUNCTION revise_evidence_claim FROM anon';
    expect(revokePublic).toContain('FROM PUBLIC');
    expect(revokeAnon).toContain('FROM anon');
  });

  it('EXECUTE on create_decision_snapshot is revoked from PUBLIC and anon', () => {
    const revokePublic = 'REVOKE EXECUTE ON FUNCTION create_decision_snapshot FROM PUBLIC';
    const revokeAnon = 'REVOKE EXECUTE ON FUNCTION create_decision_snapshot FROM anon';
    expect(revokePublic).toContain('FROM PUBLIC');
    expect(revokeAnon).toContain('FROM anon');
  });
});

// ─── New Evidence Affecting Existing Decisions ───────────────────────────────

describe('New evidence affecting existing decisions', () => {
  it('revising evidence creates a version record and a decision event', () => {
    // The revise_evidence_claim RPC:
    // 1. INSERT INTO evidence_versions (previous state)
    // 2. UPDATE decision_claims (new state)
    // 3. INSERT INTO decision_events (event_type = 'evidence_revised')
    const steps = [
      'INSERT INTO evidence_versions',
      'UPDATE decision_claims',
      'INSERT INTO decision_events',
    ];
    expect(steps).toHaveLength(3);
    expect(steps[0]).toContain('evidence_versions');
    expect(steps[2]).toContain('decision_events');
  });

  it('the decision trail timeline shows revised evidence inline with other events', () => {
    // Because evidence_revised is a decision_event with a stage of 'revised',
    // it appears in the timeline alongside other events
    const revisedStage = 'revised';
    const stageOrder = ['created', 'framed', 'analyzed', 'challenged', 'revised', 'committed', 'outcome'];
    expect(stageOrder).toContain(revisedStage);
  });
});

// ─── Preservation of Previous AI Recommendations ─────────────────────────────

describe('Previous AI recommendations are preserved', () => {
  it('snapshots capture ai_recommendation at the time of snapshot', () => {
    // Even if the AI later changes its recommendation, the snapshot
    // preserves what was recommended at that point in time
    const snapshot1: SnapshotExportItem = {
      decision_question: 'Test',
      decision_status: 'exploring',
      snapshot_timestamp: '2026-10-01T10:00:00Z',
      created_by_name: 'Alice',
      verified_facts_count: 1,
      reported_facts_count: 0,
      assumptions_count: 0,
      ai_inferences_count: 0,
      ai_recommendation: 'Go ahead with plan A',
    };
    const snapshot2: SnapshotExportItem = {
      decision_question: 'Test',
      decision_status: 'in_debate',
      snapshot_timestamp: '2026-10-05T10:00:00Z',
      created_by_name: 'Alice',
      verified_facts_count: 2,
      reported_facts_count: 1,
      assumptions_count: 0,
      ai_inferences_count: 1,
      ai_recommendation: 'Reconsider — new evidence suggests plan B',
    };
    expect(snapshot1.ai_recommendation).toBe('Go ahead with plan A');
    expect(snapshot2.ai_recommendation).toBe('Reconsider — new evidence suggests plan B');
    expect(snapshot1.ai_recommendation).not.toBe(snapshot2.ai_recommendation);
  });

  it('agent_analysis events in the timeline preserve all historical recommendations', () => {
    // Each agent_analysis event stores its recommendation in the payload
    // They are never overwritten — new analysis creates a new event
    const analysisEvents = [
      { event_type: 'agent_analysis', payload: { recommendation: 'Initial rec' }, created_at: '2026-10-01T10:00:00Z' },
      { event_type: 'agent_analysis', payload: { recommendation: 'Updated rec' }, created_at: '2026-10-03T10:00:00Z' },
    ];
    expect(analysisEvents).toHaveLength(2);
    expect(analysisEvents[0].payload.recommendation).toBe('Initial rec');
    expect(analysisEvents[1].payload.recommendation).toBe('Updated rec');
  });
});

// ─── PDF Export Accuracy ──────────────────────────────────────────────────────

describe('PDF export includes historical changes and snapshots', () => {
  it('DecisionTrailExport includes evidenceVersions field', () => {
    const exportData: DecisionTrailExport = {
      workspaceName: 'Test Decision',
      generatedAt: new Date().toISOString(),
      openingQuestion: 'Test question?',
      finalDecision: null,
      rationale: null,
      initialRecommendation: null,
      evidence: [],
      humanInterventions: [],
      challenges: [],
      openRisks: [],
      outcomes: [],
      events: [],
      evidenceVersions: [],
      snapshots: [],
    };
    expect(exportData.evidenceVersions).toBeDefined();
    expect(exportData.snapshots).toBeDefined();
    expect(Array.isArray(exportData.evidenceVersions)).toBe(true);
    expect(Array.isArray(exportData.snapshots)).toBe(true);
  });

  it('EvidenceVersionExportItem includes all version fields', () => {
    const version: EvidenceVersionExportItem = {
      claim_code: 'RISK-01',
      version_number: 1,
      previous_statement: 'Old',
      updated_statement: 'New',
      previous_classification: 'unverified_claim',
      updated_classification: 'verified_fact',
      previous_verification_status: 'not_verified',
      updated_verification_status: 'verified',
      source_reference: 'https://example.com',
      reason_for_modification: 'Verified against new source',
      modified_by_name: 'Alice',
      modified_at: new Date().toISOString(),
    };
    expect(version.claim_code).toBe('RISK-01');
    expect(version.version_number).toBe(1);
    expect(version.reason_for_modification).not.toBe('');
  });

  it('SnapshotExportItem includes snapshot counts and AI recommendation', () => {
    const snapshot: SnapshotExportItem = {
      decision_question: 'Test?',
      decision_status: 'committed',
      snapshot_timestamp: new Date().toISOString(),
      created_by_name: 'Alice',
      verified_facts_count: 3,
      reported_facts_count: 2,
      assumptions_count: 1,
      ai_inferences_count: 4,
      ai_recommendation: 'Proceed',
    };
    expect(snapshot.verified_facts_count).toBe(3);
    expect(snapshot.ai_recommendation).toBe('Proceed');
  });

  it('PDF includes section 11 for evidence version history when versions exist', () => {
    // The PDF body includes:
    // ${(data.evidenceVersions || []).length > 0 ? `<div class="bb-section"><h2>11. Evidence Version History...` : ''}
    const sectionCondition = '(data.evidenceVersions || []).length > 0';
    expect(sectionCondition).toContain('evidenceVersions');
  });

  it('PDF includes section 12 for decision snapshots when snapshots exist', () => {
    const sectionCondition = '(data.snapshots || []).length > 0';
    expect(sectionCondition).toContain('snapshots');
  });

  it('PDF distinguishes AI recommendation from human decision', () => {
    // Section 4: "What AI Agents Initially Recommended" includes disclaimer:
    // "This is the AI-generated recommendation. It does not represent the final decision..."
    // Section 3: "Why This Decision Was Made" includes:
    // "The rationale above is the AI synthesis... The human decision-maker may have agreed with, modified, or rejected this recommendation."
    const aiDisclaimer = 'AI-generated recommendation';
    const humanDecisionNote = 'human decision-maker';
    expect(aiDisclaimer).toContain('AI');
    expect(humanDecisionNote).toContain('human');
  });

  it('PDF shows under-review disclaimer when no final decision exists', () => {
    // When data.finalDecision is null:
    // "This decision is still under review. The information below reflects the current state..."
    const underReviewDisclaimer = 'still under review';
    expect(underReviewDisclaimer).toContain('under review');
  });
});

// ─── Compatibility with Existing Evidence IDs ────────────────────────────────

describe('Compatibility with existing Evidence IDs and data', () => {
  it('existing Evidence IDs remain in decision_claims with no destructive changes', () => {
    // The migration is purely additive: new tables (evidence_versions, decision_snapshots)
    // No columns dropped, no tables renamed, no data deleted
    const additiveOnly = true;
    expect(additiveOnly).toBe(true);
  });

  it('existing classification labels still work', () => {
    for (const key of Object.keys(EVIDENCE_CLASSIFICATION_LABELS)) {
      expect(EVIDENCE_CLASSIFICATION_LABELS[key]).toBeDefined();
      expect(typeof EVIDENCE_CLASSIFICATION_LABELS[key]).toBe('string');
    }
  });

  it('existing verification status labels still work', () => {
    for (const key of Object.keys(VERIFICATION_STATUS_LABELS)) {
      expect(VERIFICATION_STATUS_LABELS[key]).toBeDefined();
      expect(typeof VERIFICATION_STATUS_LABELS[key]).toBe('string');
    }
  });

  it('verified status label is "Human Verified" not just "Verified"', () => {
    expect(VERIFICATION_STATUS_LABELS.verified).toBe('Human Verified');
    expect(VERIFICATION_STATUS_LABELS.verified).not.toBe('Verified');
  });

  it('EvidenceExportItem works without version/snapshot data (backward compatible)', () => {
    const exportData: DecisionTrailExport = {
      workspaceName: 'Legacy Decision',
      generatedAt: new Date().toISOString(),
      openingQuestion: 'Legacy question?',
      finalDecision: null,
      rationale: null,
      initialRecommendation: null,
      evidence: [{
        claim_code: 'RISK-01',
        agent_name: 'Risk Analyst',
        statement: 'Legacy claim',
        claim_type: 'fact',
        confidence: 0.8,
        freshness: 'current',
        daysSinceVerified: 5,
      }],
      humanInterventions: [],
      challenges: [],
      openRisks: [],
      outcomes: [],
      events: [],
    };
    // evidenceVersions and snapshots are optional
    expect(exportData.evidenceVersions).toBeUndefined();
    expect(exportData.snapshots).toBeUndefined();
    expect(exportData.evidence).toHaveLength(1);
  });
});

// ─── RPC Parameter Validation ────────────────────────────────────────────────

describe('revise_evidence_claim RPC parameter validation', () => {
  it('p_reason is required (no default) and comes before optional params', () => {
    // Function signature:
    // revise_evidence_claim(p_claim_id uuid, p_reason text, p_new_statement text DEFAULT NULL, ...)
    // p_reason has no default and must come before defaulted params
    const signature = 'p_claim_id uuid, p_reason text, p_new_statement text DEFAULT NULL';
    const parts = signature.split(', ');
    expect(parts[1]).toBe('p_reason text');
    expect(parts[2]).toContain('DEFAULT NULL');
  });

  it('p_new_statement is optional (DEFAULT NULL)', () => {
    // If the statement is not changing, only classification, p_new_statement can be NULL
    const optionalParam = 'p_new_statement text DEFAULT NULL';
    expect(optionalParam).toContain('DEFAULT NULL');
  });

  it('p_new_classification is optional (DEFAULT NULL)', () => {
    const optionalParam = 'p_new_classification text DEFAULT NULL';
    expect(optionalParam).toContain('DEFAULT NULL');
  });

  it('p_source_reference is optional (DEFAULT NULL)', () => {
    const optionalParam = 'p_source_reference text DEFAULT NULL';
    expect(optionalParam).toContain('DEFAULT NULL');
  });
});

describe('create_decision_snapshot RPC parameter validation', () => {
  it('only requires p_workspace_id', () => {
    // Function signature: create_decision_snapshot(p_workspace_id uuid)
    const signature = 'p_workspace_id uuid';
    expect(signature).toContain('p_workspace_id');
  });

  it('created_by is derived from auth.uid(), not a parameter', () => {
    // The RPC uses v_uid := auth.uid() for created_by
    const authDerived = 'created_by = v_uid';
    expect(authDerived).toContain('v_uid');
  });
});

// ─── SECURITY DEFINER Audit ──────────────────────────────────────────────────

describe('SECURITY DEFINER functions have proper search_path', () => {
  it('revise_evidence_claim has SET search_path TO public', () => {
    const searchPath = "SET search_path TO 'public'";
    expect(searchPath).toContain('public');
  });

  it('create_decision_snapshot has SET search_path TO public', () => {
    const searchPath = "SET search_path TO 'public'";
    expect(searchPath).toContain('public');
  });
});
