import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../contexts/AuthContext';
import { useUserWorkspaces } from '../hooks/useWorkspaceAccess';
import { supabase } from '../lib/supabase';
import { TimelineView } from './DecisionTrailPage';

const origins: Record<string, string> = { openai: 'OpenAI', anthropic: 'Claude / Anthropic', google: 'Gemini / Google', microsoft: 'Microsoft Copilot', internal_ai: 'Internal AI agent', human: 'Human', other: 'Other' };

export default function DecisionRecordPage({ workspaceId, onNavigate }: { workspaceId: string | null; onNavigate: (page: string, id?: string) => void }) {
  const { user } = useAuth();
  const { workspaces, loading, error } = useUserWorkspaces();
  const workspace = workspaces.find(w => w.id === workspaceId && w.source !== 'slack');
  const record = useQuery({
    queryKey: ['user', user?.id, 'decision-record', workspaceId],
    enabled: !!user && !!workspace && !loading && !error,
    queryFn: async () => {
      const { data, error } = await supabase.from('workspaces')
        .select('id, name, description, decision_origin, decision_origin_model, created_at')
        .eq('id', workspaceId!).single();
      if (error) throw error;
      return data;
    },
  });
  const back = () => onNavigate('decision-ledger');
  return <main className="min-h-screen px-4 sm:px-8 py-6 pb-28" style={{ background: 'var(--app-bg)', color: 'var(--app-text-primary)' }}>
    {loading || (!!workspace && record.isPending && !error) ? <p>Loading decision record…</p> : error || record.error || !workspace || !record.data ? <div role="alert"><p>This decision is unavailable or access could not be verified.</p><button className="btn-secondary mt-4" onClick={back}>Back to Decision Ledger</button></div> : <>
      <div className="flex flex-wrap justify-between items-start gap-3 mb-5">
        <div><p className="section-label">Decision Record</p><h1 className="text-2xl font-bold break-words">{record.data.name}</h1></div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => onNavigate('workspace-hub', workspace.id)}>Open in War Room</button>
          {(workspace.role === 'owner' || workspace.role === 'admin') && <button className="btn-secondary" onClick={() => onNavigate('workspace-settings', workspace.id)}>Ownership & settings</button>}
        </div>
      </div>
      <section className="panel p-4 sm:p-6 mb-6 space-y-4">
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
          <div><dt>Origin (self-reported)</dt><dd className="font-semibold">{record.data.decision_origin ? origins[record.data.decision_origin] || record.data.decision_origin : 'Not recorded'}</dd>{record.data.decision_origin_model && <dd className="break-words">{record.data.decision_origin_model}</dd>}</div>
          <div><dt>Registered on</dt><dd>{new Date(record.data.created_at).toLocaleDateString()}</dd></div>
          <div><dt>Access role</dt><dd>{workspace.role}</dd></div>
        </dl>
        <div><h2 className="font-semibold mb-2">{record.data.decision_origin ? 'Registered recommendation and rationale' : 'Decision context'}</h2><p className="whitespace-pre-wrap break-words text-sm">{record.data.description || 'No context recorded.'}</p></div>
        <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>Registration does not independently verify the source or establish the original decision date.</p>
      </section>
      <TimelineView key={workspace.id} workspaceId={workspace.id} workspaceName={record.data.name} onBack={back} backLabel="Back to Decision Ledger" />
    </>}
  </main>;
}
