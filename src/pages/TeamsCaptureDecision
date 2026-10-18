import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type MessageData = { text?: string; messageId?: string; conversationId?: string; teamId?: string; source?: string; link?: string };

type TaskSDK = { app: { initialize: () => Promise<void> }; dialog?: { url?: { submit?: (result?: unknown) => void } }; tasks?: { submitTask?: (result?: unknown) => void }; };

export default function TeamsCaptureDecision() {
  const { user } = useAuth();
  const [sdk, setSdk] = useState<TaskSDK | null>(null);
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('');
  const [source, setSource] = useState<MessageData>({});
  const [workspaces, setWorkspaces] = useState<{ id: string; name: string }[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const teams = (window as Window & { microsoftTeams?: TaskSDK }).microsoftTeams;
        if (!teams) return;
        await teams.app.initialize();
        if (!active) return;
        setSdk(teams as unknown as TaskSDK);
        // The Teams action supplies message context via URL parameters only when explicitly configured.
        // No Graph permissions or automatic conversation harvesting are used.
        const params = new URLSearchParams(window.location.search);
        const incoming = {
          text: params.get('messageText') || '',
          messageId: params.get('messageId') || '',
          conversationId: params.get('conversationId') || '',
          teamId: params.get('teamId') || '',
          link: params.get('messageLink') || '',
          source: params.get('source') || 'teams',
        };
        setSource(incoming);
        setContext(incoming.text);
      } catch {
        // The capture form also works in a regular browser for manually reviewed content.
      }
    })();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    (async () => {
      const [owned, memberships] = await Promise.all([
        supabase.from('workspaces').select('id,name').eq('owner_id', user.id),
        supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id),
      ]);
      if (!active) return;
      if (owned.error || memberships.error) { setError('Unable to load your workspaces.'); return; }
      const ids = (memberships.data || []).map(m => m.workspace_id);
      const joined = ids.length ? await supabase.from('workspaces').select('id,name').in('id', ids) : { data: [], error: null };
      if (!active) return;
      if (joined.error) { setError('Unable to load your workspaces.'); return; }
      const unique = new Map<string, { id: string; name: string }>();
      [...(owned.data || []), ...(joined.data || [])].forEach(w => unique.set(w.id, w));
      const list = [...unique.values()].sort((a,b) => a.name.localeCompare(b.name));
      setWorkspaces(list);
      if (list.length) setWorkspaceId(list[0].id);
    })();
    return () => { active = false; };
  }, [user]);

  async function save() {
    setError('');
    if (!user) { setError('Sign in to Poddle in Teams before capturing a decision.'); return; }
    if (!workspaceId || !title.trim() || !context.trim()) { setError('Select a workspace and enter a title and message context.'); return; }
    setSaving(true);
    const { error: insertError } = await supabase.from('teams_decision_captures').insert({
      workspace_id: workspaceId,
      title: title.trim().slice(0, 160),
      context: context.trim().slice(0, 12000),
      source_message_id: source.messageId || null,
      source_conversation_id: source.conversationId || null,
      source_team_id: source.teamId || null,
      source_url: source.link || null,
      source_type: source.teamId ? 'channel' : 'chat',
      created_by: user.id,
    });
    setSaving(false);
    if (insertError) { setError(insertError.message); return; }
    setSaved(true);
    // Closing is optional: leave a success state if opened as a normal page.
    try { sdk?.dialog?.url?.submit?.({ captured: true }); } catch { /* leave success visible */ }
  }

  return <main className="min-h-screen bg-slate-50 p-5 text-slate-900"><section className="mx-auto max-w-xl rounded-xl bg-white p-6 shadow-sm border border-slate-200">
    <h1 className="text-2xl font-bold">Capture Decision in Poddle</h1>
    <p className="mt-2 text-sm text-slate-600">Review the Teams message before saving. Captured discussion is unverified source material, not verified evidence or a final decision.</p>
    {!user && <p className="mt-4 rounded bg-amber-50 p-3 text-sm">Sign in to Poddle in the Teams tab first, then return here.</p>}
    {saved ? <div className="mt-5 rounded bg-green-50 p-4">Decision capture saved to your workspace. Open Poddle to review it.</div> : <div className="mt-5 space-y-4">
      <label className="block text-sm font-semibold">Decision title<input maxLength={160} className="mt-1 w-full rounded border p-2" value={title} onChange={e => setTitle(e.target.value)} placeholder="What decision needs to be made?" /></label>
      <label className="block text-sm font-semibold">Destination workspace<select className="mt-1 w-full rounded border p-2" value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}><option value="">Choose a workspace</option>{workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
      <label className="block text-sm font-semibold">Teams discussion (review and edit)<textarea maxLength={12000} rows={7} className="mt-1 w-full rounded border p-2" value={context} onChange={e => setContext(e.target.value)} placeholder="Paste the Teams message or decision discussion you are authorized to share." /></label>
      {error && <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <button disabled={saving || !user} onClick={() => void save()} className="rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{saving ? 'Saving…' : 'Save reviewed capture'}</button>
    </div>}
  </section></main>;
}
