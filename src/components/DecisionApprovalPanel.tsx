import { useState, useEffect, useCallback, useMemo } from 'react';
import { CheckCircle2, XCircle, Send, RotateCcw, Loader2, AlertCircle, Clock, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import DecisionVersionHistory from './DecisionVersionHistory';
import DecisionFinancialCommitments from './DecisionFinancialCommitments';

type LifecycleStatus = 'draft' | 'under_review' | 'approved' | 'rejected';

interface Lifecycle {
  status: LifecycleStatus;
  approver_user_id: string | null;
  submitted_at: string | null;
  decision_note: string | null;
  approval_cycle: number;
  current_version_id: string | null;
}

type LifecycleAction = 'submit' | 'approve' | 'reject' | 'request_changes' | 'reopen' | 'withdraw' | 'amend';

interface DirectoryEntry {
  name: string;
  email: string | null;
  role: string;
}

interface DecisionApprovalPanelProps {
  workspaceId: string;
  currentUserId: string;
  onChanged?: () => void;
}

const STATUS_STYLE: Record<LifecycleStatus, { label: string; color: string; background: string }> = {
  draft: { label: 'Draft', color: '#334155', background: '#e2e8f0' },
  under_review: { label: 'Under Review', color: '#92400e', background: '#fef3c7' },
  approved: { label: 'Approved', color: '#166534', background: '#dcfce7' },
  rejected: { label: 'Rejected', color: '#991b1b', background: '#fee2e2' },
};

const ROLE_LABEL: Record<string, string> = {
  owner: 'Workspace Owner',
  admin: 'Workspace Admin',
  member: 'Workspace Member',
};

const FORMER_MEMBER_LABEL = 'a former workspace member';

function formatDate(value: string | null): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, { dateStyle: 'medium' });
}

export default function DecisionApprovalPanel({ workspaceId, currentUserId, onChanged }: DecisionApprovalPanelProps) {
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [directory, setDirectory] = useState<Record<string, DirectoryEntry>>({});
  const [currentVersionNumber, setCurrentVersionNumber] = useState<number | null>(null);
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');
  const [approverQuery, setApproverQuery] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'idle' | 'reject' | 'changes' | 'amend'>('idle');

  const load = useCallback(async () => {
    setError('');
    const [lcRes, memberRes, wsRes, ownersRes, versionRes] = await Promise.all([
      supabase.from('decision_lifecycles').select('status, approver_user_id, submitted_at, decision_note, approval_cycle, current_version_id').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('workspace_members').select('user_id, role, profiles(full_name, email)').eq('workspace_id', workspaceId),
      supabase.from('workspaces').select('owner_id, decision_category, decision_owner_override_user_id').eq('id', workspaceId).maybeSingle(),
      supabase.from('domain_owners').select('category_key, owner_user_id, backup_owner_user_id').eq('workspace_id', workspaceId),
      supabase.from('decision_versions').select('id, version_number').eq('workspace_id', workspaceId),
    ]);
    const firstError = [lcRes, memberRes, wsRes, ownersRes, versionRes].find(r => r.error)?.error;
    if (firstError) {
      setError('Approval status could not be loaded.');
      setLoading(false);
      return;
    }

    const members = (memberRes.data ?? []) as Array<{ user_id: string; role: string; profiles: Array<{ full_name: string | null; email: string | null }> }>;
    const myRole = members.find(m => m.user_id === currentUserId)?.role ?? null;
    const ws = wsRes.data;
    const domainMatch = (ownersRes.data ?? []).find(d => d.category_key === ws?.decision_category);
    const isDecisionOwner = !!ws && (
      ws.owner_id === currentUserId ||
      ws.decision_owner_override_user_id === currentUserId ||
      domainMatch?.owner_user_id === currentUserId ||
      domainMatch?.backup_owner_user_id === currentUserId
    );

    setCanSubmit(myRole === 'owner' || myRole === 'admin' || isDecisionOwner);

    const nextDirectory: Record<string, DirectoryEntry> = {};
    for (const m of members) {
      const profile = m.profiles[0];
      nextDirectory[m.user_id] = {
        name: profile?.full_name || profile?.email || 'Unnamed member',
        email: profile?.email ?? null,
        role: m.role,
      };
    }
    setDirectory(nextDirectory);

    const lc = (lcRes.data as Lifecycle | null) ?? { status: 'draft', approver_user_id: null, submitted_at: null, decision_note: null, approval_cycle: 0, current_version_id: null };
    setLifecycle(lc);
    const versions = (versionRes.data ?? []) as Array<{ id: string; version_number: number }>;
    setCurrentVersionNumber(versions.find(v => v.id === lc.current_version_id)?.version_number ?? null);
    setLoading(false);
  }, [workspaceId, currentUserId]);

  useEffect(() => { void load(); }, [load]);

  const approvers = useMemo(
    () => Object.entries(directory)
      .filter(([userId, entry]) => (entry.role === 'owner' || entry.role === 'admin') && userId !== currentUserId)
      .map(([userId, entry]) => ({ user_id: userId, ...entry }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    [directory, currentUserId],
  );

  const memberNames = useMemo(
    () => Object.fromEntries(Object.entries(directory).map(([userId, entry]) => [userId, entry.name])),
    [directory],
  );

  async function runAction(action: LifecycleAction, payload: { note?: string | null; approver?: string | null }) {
    setBusy(true);
    setError('');
    const { data, error: rpcError } = await supabase.rpc('decision_lifecycle_action', {
      p_workspace_id: workspaceId,
      p_action: action,
      p_note: payload.note ?? null,
      p_approver_user_id: payload.approver ?? null,
    });
    setBusy(false);
    if (rpcError || !data) {
      setError(rpcError?.message || 'The status could not be changed. Please try again.');
      return;
    }
    setLifecycle(data as Lifecycle);
    setMode('idle');
    setNote('');
    setSelectedApprover('');
    setApproverQuery('');
    onChanged?.();
    void load();
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--app-text-muted)' }} />
      </div>
    );
  }

  const status = lifecycle?.status ?? 'draft';
  const style = STATUS_STYLE[status];
  const isAssignedApprover = status === 'under_review' && lifecycle?.approver_user_id === currentUserId;
  const approverEntry = lifecycle?.approver_user_id ? directory[lifecycle.approver_user_id] : undefined;
  const approverName = approverEntry?.name ?? FORMER_MEMBER_LABEL;
  const isResubmission = status === 'draft' && (lifecycle?.approval_cycle ?? 0) > 0;
  const query = approverQuery.trim().toLowerCase();
  const visibleApprovers = query
    ? approvers.filter(a => a.name.toLowerCase().includes(query) || (a.email ?? '').toLowerCase().includes(query))
    : approvers;
  const selected = approvers.find(a => a.user_id === selectedApprover) ?? null;
  const noteConfig = mode === 'reject'
    ? { label: 'Reason for rejection (required)', action: 'reject' as const, button: 'Confirm rejection' }
    : mode === 'amend'
      ? { label: 'What is changing (required)', action: 'amend' as const, button: 'Reopen for amendment' }
      : { label: 'What needs to change (required)', action: 'request_changes' as const, button: 'Return to Draft' };

  return (
    <section className="panel p-4 mb-4 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Status</span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
            style={{ color: style.color, background: style.background }}
          >
            {style.label}
          </span>
        </div>
      </div>

      {status === 'under_review' && (
        <div className="p-3 rounded-lg space-y-1" style={{ border: '1px solid var(--app-border)' }}>
          <p className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--app-text)' }}>
            <Clock className="w-3.5 h-3.5 flex-shrink-0" />
            Awaiting approval from {isAssignedApprover ? 'you' : approverName}
          </p>
          {approverEntry && !isAssignedApprover && (
            <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
              {ROLE_LABEL[approverEntry.role] ?? approverEntry.role}{approverEntry.email ? ` · ${approverEntry.email}` : ''}
            </p>
          )}
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
            Decision Version {currentVersionNumber ?? '?'} · Approval cycle {lifecycle?.approval_cycle ?? 0} · Submitted {formatDate(lifecycle?.submitted_at ?? null)}
          </p>
        </div>
      )}

      {lifecycle?.decision_note && status !== 'under_review' && (
        <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
          Latest note: {lifecycle.decision_note}
        </p>
      )}

      {error && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" style={{ color: 'var(--negative)' }} />
          <p className="text-xs font-medium" style={{ color: 'var(--negative)' }}>{error}</p>
        </div>
      )}

      {status === 'draft' && canSubmit && (
        <div className="space-y-3">
          {isResubmission && (
            <>
              <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                This decision was sent back or changed after an earlier submission. Explain what changed before resubmitting.
              </p>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                rows={3}
                placeholder="What changed since the last submission"
                className="input-modern text-sm w-full"
              />
            </>
          )}
          <div className="space-y-2">
            <p className="text-xs font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Who approves this decision</p>
            {approvers.length === 0 ? (
              <p className="text-xs" style={{ color: 'var(--negative)' }}>
                This decision cannot be submitted yet. Approvals must be given by a workspace owner or admin, and this workspace has no other owner or admin to approve it. Add one, then submit again.
              </p>
            ) : (
              <>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'var(--app-text-muted)' }} />
                  <input
                    type="search"
                    value={approverQuery}
                    onChange={e => setApproverQuery(e.target.value)}
                    placeholder="Search owners and admins by name or email"
                    aria-label="Search approvers"
                    className="input-modern text-xs w-full"
                    style={{ paddingLeft: '2rem', padding: '0.5rem 0.625rem 0.5rem 2rem' }}
                  />
                </div>
                <ul role="listbox" aria-label="Eligible approvers" className="max-h-56 overflow-y-auto rounded-lg divide-y" style={{ border: '1px solid var(--app-border)' }}>
                  {visibleApprovers.length === 0 ? (
                    <li className="px-3 py-2.5 text-xs" style={{ color: 'var(--app-text-muted)' }}>No approver matches "{approverQuery.trim()}".</li>
                  ) : visibleApprovers.map(a => {
                    const isSelected = a.user_id === selectedApprover;
                    return (
                      <li key={a.user_id} role="option" aria-selected={isSelected}>
                        <button
                          type="button"
                          onClick={() => setSelectedApprover(a.user_id)}
                          className="w-full text-left px-3 py-2 flex flex-col gap-0.5 transition-colors"
                          style={{ background: isSelected ? 'var(--app-surface-hover, rgba(148, 163, 184, 0.15))' : 'transparent', color: 'var(--app-text)' }}
                        >
                          <span className="text-sm font-medium">{a.name}</span>
                          <span className="text-[11px]" style={{ color: 'var(--app-text-secondary)' }}>
                            {ROLE_LABEL[a.role] ?? a.role}{a.email && a.email !== a.name ? ` · ${a.email}` : ''}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {selected && (
                  <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>
                    Selected approver: <span className="font-semibold" style={{ color: 'var(--app-text)' }}>{selected.name}</span>
                    {` · ${ROLE_LABEL[selected.role] ?? selected.role}`}{selected.email && selected.email !== selected.name ? ` · ${selected.email}` : ''}
                  </p>
                )}
              </>
            )}
          </div>
          {approvers.length > 0 && (
            <button
              onClick={() => runAction('submit', { approver: selectedApprover, note })}
              disabled={busy || !selectedApprover || (isResubmission && !note.trim())}
              className="btn-primary flex items-center gap-1.5"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {isResubmission ? 'Resubmit for Approval' : 'Submit for Approval'}
            </button>
          )}
        </div>
      )}

      {status === 'draft' && !canSubmit && (
        <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
          The decision owner can submit this decision for approval.
        </p>
      )}

      {isAssignedApprover && mode === 'idle' && (
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => runAction('approve', { note: null })} disabled={busy} className="btn-primary flex items-center gap-1.5">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Approve
          </button>
          <button onClick={() => setMode('changes')} disabled={busy} className="btn-secondary">Request changes</button>
          <button onClick={() => setMode('reject')} disabled={busy} className="btn-secondary" style={{ color: 'var(--negative)' }}>Reject</button>
        </div>
      )}

      {status === 'under_review' && canSubmit && !isAssignedApprover && mode === 'idle' && (
        <button onClick={() => runAction('withdraw', {})} disabled={busy} className="btn-secondary flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4" />
          Withdraw submission
        </button>
      )}

      {((isAssignedApprover && mode !== 'idle' && mode !== 'amend') || mode === 'amend') && (
        <div className="space-y-2">
          <label className="block text-xs font-semibold" style={{ color: 'var(--app-text-secondary)' }}>
            {noteConfig.label}
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            className="input-modern text-sm w-full"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => runAction(noteConfig.action, { note })}
              disabled={busy || !note.trim()}
              className="btn-primary"
            >
              {noteConfig.button}
            </button>
            <button onClick={() => { setMode('idle'); setNote(''); }} disabled={busy} className="btn-ghost">Cancel</button>
          </div>
        </div>
      )}

      {status === 'rejected' && canSubmit && (
        <button onClick={() => runAction('reopen', {})} disabled={busy} className="btn-secondary flex items-center gap-1.5">
          <RotateCcw className="w-4 h-4" />
          Reopen as Draft
        </button>
      )}

      {status === 'approved' && (
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#166534' }}>
            <CheckCircle2 className="w-3.5 h-3.5" />
            This decision has been approved.
          </p>
          {canSubmit && mode === 'idle' && (
            <button onClick={() => setMode('amend')} disabled={busy} className="btn-secondary">Amend decision</button>
          )}
        </div>
      )}
      {status === 'rejected' && !canSubmit && (
        <p className="flex items-center gap-1.5 text-xs font-medium" style={{ color: '#991b1b' }}>
          <XCircle className="w-3.5 h-3.5" />
          This decision was rejected.
        </p>
      )}

      <div className="pt-3 border-t space-y-2" style={{ borderColor: 'var(--app-border)' }}>
        <p className="text-[11px] font-semibold uppercase tracking-widest" style={{ color: 'var(--app-text-muted)' }}>Financial commitments</p>
        <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
          The money and resources this decision involves. They do not determine who approves it.
        </p>
        <DecisionFinancialCommitments workspaceId={workspaceId} currentUserId={currentUserId} />
      </div>

      <DecisionVersionHistory
        workspaceId={workspaceId}
        memberNames={memberNames}
        refreshKey={`${status}-${lifecycle?.approval_cycle ?? 0}`}
      />
    </section>
  );
}
