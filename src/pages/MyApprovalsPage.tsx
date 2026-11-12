import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ClipboardCheck, ExternalLink, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import DecisionApprovalPanel from '../components/DecisionApprovalPanel';

interface PendingApproval {
  workspace_id: string;
  submitted_at: string | null;
  name: string;
}

type WorkspaceEmbed = { name: string | null } | Array<{ name: string | null }> | null;

export default function MyApprovalsPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!user) return;
    setError('');
    const { data, error: queryError } = await supabase
      .from('decision_lifecycles')
      .select('workspace_id, submitted_at, workspaces(name)')
      .eq('status', 'under_review')
      .eq('approver_user_id', user.id)
      .order('submitted_at', { ascending: true });
    if (queryError) {
      setError('Your approvals could not be loaded. Please try again.');
      setLoading(false);
      return;
    }
    const rows = (data ?? []) as Array<{ workspace_id: string; submitted_at: string | null; workspaces: WorkspaceEmbed }>;
    setItems(rows.map(row => {
      const ws = Array.isArray(row.workspaces) ? row.workspaces[0] : row.workspaces;
      return {
        workspace_id: row.workspace_id,
        submitted_at: row.submitted_at,
        name: ws?.name?.trim() || 'Untitled decision',
      };
    }));
    setLoading(false);
  }, [user]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--app-text)' }}>My Approvals</h1>
        <p className="text-sm" style={{ color: 'var(--app-text-muted)' }}>Decisions waiting for your review.</p>
      </header>

      {loading && (
        <div className="flex justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--app-text-muted)' }} />
        </div>
      )}

      {!loading && error && (
        <div className="flex items-center gap-2 p-3 rounded-lg" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--negative)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--negative)' }}>{error}</p>
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div className="panel p-8 text-center space-y-2">
          <ClipboardCheck className="w-8 h-8 mx-auto" style={{ color: 'var(--app-text-muted)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--app-text)' }}>Nothing is waiting for your review.</p>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>When someone submits a decision to you, it will appear here.</p>
        </div>
      )}

      {!loading && items.map(item => (
        <article key={item.workspace_id} className="space-y-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate" style={{ color: 'var(--app-text)' }}>{item.name}</h2>
              {item.submitted_at && (
                <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>
                  Submitted {new Date(item.submitted_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              )}
            </div>
            <button
              onClick={() => { window.location.hash = `decision-trail/${encodeURIComponent(item.workspace_id)}`; }}
              className="btn-ghost flex items-center gap-1.5 text-xs"
            >
              Open decision
              <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          <DecisionApprovalPanel workspaceId={item.workspace_id} currentUserId={user.id} onChanged={() => { void load(); }} />
        </article>
      ))}
    </div>
  );
}
