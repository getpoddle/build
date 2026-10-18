import { useEffect, useState } from 'react';
import { ExternalLink, Loader2, RefreshCw, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

type Capture = {
  id: string;
  title: string;
  context: string;
  source_type: string;
  source_url: string | null;
  source_message_id: string | null;
  source_conversation_id: string | null;
  source_team_id: string | null;
  verification_status: string;
  created_at: string;
};

export default function TeamsCapturesPanel({ workspaceId, onClose, onAnalyze }: { workspaceId: string; onClose: () => void; onAnalyze: (title: string, context: string, sourceUrl: string | null) => void }) {
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    supabase.from('teams_decision_captures')
      .select('id,title,context,source_type,source_url,source_message_id,source_conversation_id,source_team_id,verification_status,created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(100)
      .then(({ data, error: queryError }) => {
        if (!active) return;
        setLoading(false);
        if (queryError) setError(queryError.message);
        else setCaptures((data || []) as Capture[]);
      });
    return () => { active = false; };
  }, [workspaceId, refreshKey]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-6" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="Teams Captures" className="flex w-full max-w-3xl max-h-[90dvh] flex-col overflow-hidden rounded-xl shadow-2xl" style={{ background: 'var(--app-surface-raised)', color: 'var(--app-text-primary)' }}>
        <header className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: 'var(--app-border)' }}>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-semibold">Teams Captures</h2>
            <p className="text-xs mt-1" style={{ color: 'var(--app-text-secondary)' }}>Reviewed Microsoft Teams discussions · Unverified source material</p>
          </div>
          <button type="button" className="btn-ghost p-2" onClick={() => setRefreshKey(k => k + 1)} aria-label="Refresh captures" title="Refresh captures"><RefreshCw className="w-4 h-4" /></button>
          <button type="button" className="btn-ghost p-2" onClick={onClose} aria-label="Close Teams captures"><X className="w-4 h-4" /></button>
        </header>
        <div className="overflow-y-auto p-5 space-y-3">
          {loading && <div className="flex items-center gap-2 text-sm"><Loader2 className="w-4 h-4 animate-spin" /> Loading captures…</div>}
          {!loading && error && <div role="alert" className="text-sm" style={{ color: 'var(--negative)' }}>Unable to load Teams captures: {error}</div>}
          {!loading && !error && captures.length === 0 && <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>No Teams captures in this workspace yet. Capture a discussion from Microsoft Teams and refresh this view.</p>}
          {!loading && !error && captures.map(c => (
            <article key={c.id} className="rounded-lg border p-4" style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)' }}>
              <button type="button" className="w-full text-left" aria-expanded={selected === c.id} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold break-words">{c.title}</h3>
                  <span className="rounded border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--app-border)', color: 'var(--app-text-secondary)' }}>{c.verification_status}</span>
                </div>
                <p className="mt-2 text-xs" style={{ color: 'var(--app-text-secondary)' }}>{c.source_type === 'channel' ? 'Teams channel' : 'Teams chat'} · {new Date(c.created_at).toLocaleString()}</p>
                {selected !== c.id && <p className="mt-2 text-sm line-clamp-2 whitespace-pre-wrap break-words">{c.context}</p>}
              </button>
              {selected === c.id && <div className="mt-3 space-y-3 border-t pt-3" style={{ borderColor: 'var(--app-border)' }}>
                <p className="text-sm whitespace-pre-wrap break-words">{c.context}</p>
                <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>Captured discussion is not verified evidence or a finalized decision.</p>
                <button type="button" className="rounded-lg px-3 py-2 text-sm font-semibold" style={{ background: 'var(--app-accent, #2563eb)', color: '#fff' }} onClick={() => onAnalyze(c.title, c.context, c.source_url)}>Discuss with Poddle AI →</button>
                {c.source_message_id && <p className="text-xs break-all">Message ID: {c.source_message_id}</p>}
                {c.source_conversation_id && <p className="text-xs break-all">Conversation ID: {c.source_conversation_id}</p>}
                {c.source_team_id && <p className="text-xs break-all">Team ID: {c.source_team_id}</p>}
                {c.source_url && /^https:\/\//i.test(c.source_url) && <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm underline">Open original Teams message <ExternalLink className="w-3 h-3" /></a>}
              </div>}
            </article>
          ))}
          {!loading && !error && captures.length === 100 && <p className="text-xs" style={{ color: 'var(--app-text-secondary)' }}>Showing the 100 most recent captures.</p>}
        </div>
      </section>
    </div>
  );
}
