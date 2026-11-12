import { useEffect, useMemo, useState } from 'react';
import { History, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { describeVersionChanges, type DecisionVersionContent } from '../lib/decisionVersionDiff';

type Outcome = 'pending' | 'approved' | 'rejected' | 'changes_requested' | 'withdrawn' | 'superseded';

interface VersionRow {
  id: string;
  version_number: number;
  content_hash: string;
  content: DecisionVersionContent;
  created_at: string;
}

interface ApprovalRequestRow {
  id: string;
  version_id: string;
  approval_cycle: number;
  approver_user_id: string;
  submitted_at: string;
  submission_note: string | null;
  outcome: Outcome;
  decided_at: string | null;
  justification: string | null;
}

interface DecisionVersionHistoryProps {
  workspaceId: string;
  memberNames: Record<string, string>;
  refreshKey: string;
}

const OUTCOME_STYLE: Record<Outcome, { label: string; color: string; background: string }> = {
  pending: { label: 'Awaiting decision', color: '#92400e', background: '#fef3c7' },
  approved: { label: 'Approved', color: '#166534', background: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#991b1b', background: '#fee2e2' },
  changes_requested: { label: 'Changes requested', color: '#92400e', background: '#fef3c7' },
  withdrawn: { label: 'Withdrawn', color: '#334155', background: '#e2e8f0' },
  superseded: { label: 'Superseded by a change', color: '#334155', background: '#e2e8f0' },
};

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

function isVersionContent(value: unknown): value is DecisionVersionContent {
  return typeof value === 'object' && value !== null && Array.isArray((value as DecisionVersionContent).claims);
}

export default function DecisionVersionHistory({ workspaceId, memberNames, refreshKey }: DecisionVersionHistoryProps) {
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [requests, setRequests] = useState<ApprovalRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compareId, setCompareId] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      const [versionRes, requestRes] = await Promise.all([
        supabase
          .from('decision_versions')
          .select('id, version_number, content_hash, content, created_at')
          .eq('workspace_id', workspaceId)
          .order('version_number', { ascending: false }),
        supabase
          .from('decision_approval_requests')
          .select('id, version_id, approval_cycle, approver_user_id, submitted_at, submission_note, outcome, decided_at, justification')
          .eq('workspace_id', workspaceId)
          .order('approval_cycle', { ascending: false }),
      ]);
      if (cancelled) return;
      if (versionRes.error || requestRes.error) {
        setError('Version history could not be loaded.');
        setLoading(false);
        return;
      }
      const loadedVersions = (versionRes.data ?? []) as VersionRow[];
      if (loadedVersions.some(v => !isVersionContent(v.content))) {
        setError('Version history could not be read.');
        setLoading(false);
        return;
      }
      setVersions(loadedVersions);
      setRequests((requestRes.data ?? []) as ApprovalRequestRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId, refreshKey]);

  const versionById = useMemo(() => new Map(versions.map(v => [v.id, v])), [versions]);
  const approvedVersionIds = useMemo(
    () => new Set(requests.filter(r => r.outcome === 'approved').map(r => r.version_id)),
    [requests],
  );
  const latest = versions[0] ?? null;
  const compareCandidates = versions.slice(1);
  const defaultCompare = compareCandidates.find(v => approvedVersionIds.has(v.id)) ?? compareCandidates[0] ?? null;
  const compareVersion = versions.find(v => v.id === compareId) ?? defaultCompare;

  const changes = latest && compareVersion
    ? describeVersionChanges(compareVersion.content, latest.content)
    : [];

  if (loading) {
    return <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--app-text-muted)' }} />;
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--negative)' }} />
        <p className="text-xs font-medium" style={{ color: 'var(--negative)' }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-3 border-t" style={{ borderColor: 'var(--app-border)' }}>
      <div className="flex items-center gap-2">
        <History className="w-3.5 h-3.5" style={{ color: 'var(--app-text-muted)' }} />
        <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>
          Versions and approval history
        </span>
        {latest && (
          <span className="text-xs font-medium" style={{ color: 'var(--app-text-secondary)' }}>
            Current version: {latest.version_number}
          </span>
        )}
      </div>

      {!latest && (
        <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
          No version has been submitted for approval yet.
        </p>
      )}

      {requests.length > 0 && (
        <ol className="space-y-2">
          {requests.map(req => {
            const version = versionById.get(req.version_id);
            const style = OUTCOME_STYLE[req.outcome];
            return (
              <li key={req.id} className="p-3 rounded-lg space-y-1.5" style={{ border: '1px solid var(--app-border)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="text-xs font-semibold" style={{ color: 'var(--app-text-primary)' }}>
                    Cycle {req.approval_cycle} · Version {version?.version_number ?? '?'}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ color: style.color, background: style.background }}>
                    {style.label}
                  </span>
                </div>
                <p className="text-[11px]" style={{ color: 'var(--app-text-muted)' }}>
                  Sent to {memberNames[req.approver_user_id] ?? 'an approver'} on {formatDate(req.submitted_at)}
                  {req.decided_at ? ` · Decided ${formatDate(req.decided_at)}` : ''}
                </p>
                {req.submission_note && (
                  <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                    Submitted with: {req.submission_note}
                  </p>
                )}
                {req.justification && (
                  <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                    Decision note: {req.justification}
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {compareCandidates.length > 0 && latest && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <label className="text-xs font-semibold" style={{ color: 'var(--app-text-secondary)' }} htmlFor="compare-version">
              Compare version {latest.version_number} with
            </label>
            <select
              id="compare-version"
              value={compareVersion?.id ?? ''}
              onChange={e => setCompareId(e.target.value)}
              className="input-modern text-xs"
              style={{ padding: '0.375rem 0.5rem' }}
            >
              {compareCandidates.map(v => (
                <option key={v.id} value={v.id}>
                  Version {v.version_number}{approvedVersionIds.has(v.id) ? ' (approved)' : ''}
                </option>
              ))}
            </select>
          </div>
          {changes.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>No differences in the decision content.</p>
          ) : (
            <ul className="text-xs space-y-1 list-disc pl-5" style={{ color: 'var(--app-text-secondary)' }}>
              {changes.map(change => <li key={change}>{change}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
