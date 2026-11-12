import { useState, useEffect, useCallback } from 'react';
import { CheckCircle2, XCircle, Send, RotateCcw, Loader2, AlertCircle, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';

type LifecycleStatus = 'draft' | 'under_review' | 'approved' | 'rejected';

interface Lifecycle {
  status: LifecycleStatus;
  approver_user_id: string | null;
  submitted_at: string | null;
  decision_note: string | null;
}

type LifecycleAction = 'submit' | 'approve' | 'reject' | 'request_changes' | 'reopen' | 'withdraw' | 'amend';

interface Approver {
  user_id: string;
  name: string;
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

export default function DecisionApprovalPanel({ workspaceId, currentUserId, onChanged }: DecisionApprovalPanelProps) {
  const [lifecycle, setLifecycle] = useState<Lifecycle | null>(null);
  const [approvers, setApprovers] = useState<Approver[]>([]);
  const [canSubmit, setCanSubmit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedApprover, setSelectedApprover] = useState('');
  const [note, setNote] = useState('');
  const [mode, setMode] = useState<'idle' | 'reject' | 'changes' | 'amend'>('idle');

  const load = useCallback(async () => {
    setError('');
    const [lcRes, memberRes, wsRes, ownersRes] = await Promise.all([
      supabase.from('decision_lifecycles').select('status, approver_user_id, submitted_at, decision_note').eq('workspace_id', workspaceId).maybeSingle(),
      supabase.from('workspace_members').select('user_id, role, profiles(full_name, email)').eq('workspace_id', workspaceId),
      supabase.from('workspaces').select('owner_id, decision_category, decision_owner_override_user_id').eq('id', workspaceId).maybeSingle(),
      supabase.from('domain_owners').select('category_key, owner_user_id, backup_owner_user_id').eq('workspace_id', workspaceId),
    ]);
    const firstError = [lcRes, memberRes, wsRes, ownersRes].find(r => r.error)?.error;
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
    setApprovers(
      members
        .filter(m => (m.role === 'owner' || m.role === 'admin') && m.user_id !== currentUserId)
        .map(m => ({ user_id: m.user_id, name: m.profiles[0]?.full_name || m.profiles[0]?.email || 'Member' }))
    );
    setLifecycle((lcRes.data as Lifecycle | null) ?? { status: 'draft', approver_user_id: null, submitted_at: null, decision_note: null });
    setLoading(false);
  }, [workspaceId, currentUserId]);

  useEffect(() => { void load(); }, [load]);

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
    onChanged?.();
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
  const approverName = approvers.find(a => a.user_id === lifecycle?.approver_user_id)?.name ?? 'the assigned approver';
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
        {status === 'under_review' && (
          <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--app-text-muted)' }}>
            <Clock className="w-3.5 h-3.5" />
            {isAssignedApprover ? 'Awaiting your decision' : `Awaiting ${approverName}`}
          </span>
        )}
      </div>

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
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedApprover}
            onChange={e => setSelectedApprover(e.target.value)}
            className="input-modern text-xs flex-1 min-w-[12rem]"
            style={{ padding: '0.5rem 0.625rem' }}
          >
            <option value="">Choose an approver</option>
            {approvers.map(a => <option key={a.user_id} value={a.user_id}>{a.name}</option>)}
          </select>
          <button
            onClick={() => runAction('submit', { approver: selectedApprover })}
            disabled={busy || !selectedApprover}
            className="btn-primary flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Submit for Approval
          </button>
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
    </section>
  );
}
