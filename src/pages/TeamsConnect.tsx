import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'poddle_teams_link_pending';
const TOKEN_PATTERN = /^[0-9a-f]{64}$/;

export default function TeamsConnect() {
  const { user, session, loading } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    document.title = 'Connect Microsoft Teams | Poddle';
    const params = new URLSearchParams(window.location.search);
    const incoming = params.get('token');
    // Remove the bearer-style link token from the address bar immediately.
    if (incoming !== null) {
      history.replaceState(history.state, '', '/teams/connect');
      if (TOKEN_PATTERN.test(incoming)) sessionStorage.setItem(STORAGE_KEY, incoming);
      else sessionStorage.removeItem(STORAGE_KEY);
    }
    const saved = sessionStorage.getItem(STORAGE_KEY);
    setToken(saved && TOKEN_PATTERN.test(saved) ? saved : null);
    return () => { meta.remove(); };
  }, []);

  const approve = async () => {
    if (!token || !user || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !currentSession?.access_token || currentSession.user.id !== user.id) {
        setMessage('Your session has expired. Sign in again to continue.');
        return;
      }
      const { data, error } = await supabase.functions.invoke('teams-complete-link', {
        body: { token, approved: true },
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
      if (error || !data?.success) {
        setMessage(data?.error || 'Could not complete linking. The link may have expired or already been used. Request a new link in Teams.');
        return;
      }
      sessionStorage.removeItem(STORAGE_KEY);
      setToken(null);
      setConnected(true);
      setMessage('Microsoft Teams has been connected to your Poddle account.');
    } catch {
      setMessage('Connection failed. Please try again or request a new link in Teams.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center px-5 py-12">
      <section className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 shadow-sm p-8">
        <div className="text-sm font-bold tracking-wide text-blue-700 mb-4">PODDLE × MICROSOFT TEAMS</div>
        <h1 className="text-2xl font-bold text-slate-900 mb-3">Connect your Poddle account</h1>
        <p className="text-slate-600 mb-6">Connect your Microsoft Teams identity to the Poddle account you choose. Your existing workspaces and decision records stay in your Poddle account.</p>
        {connected ? (
          <div role="status" className="rounded-lg bg-green-50 p-4 text-green-800">{message}</div>
        ) : !token ? (
          <div role="alert" className="rounded-lg bg-amber-50 p-4 text-amber-900">No valid linking request was found. Return to the Poddle bot in Teams and request a new connection link.</div>
        ) : loading ? (
          <p role="status" className="text-slate-600">Checking your Poddle session…</p>
        ) : !user || !session ? (
          <div>
            <p className="font-medium text-slate-800 mb-3">Sign in to the Poddle account you want to connect.</p>
            <p className="text-sm text-slate-600 mb-4">Open sign-in in another tab, then return here. This link expires after 10 minutes.</p>
            <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex rounded-lg bg-blue-700 text-white px-5 py-3 font-semibold">Open Poddle sign-in</a>
          </div>
        ) : (
          <div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 mb-5">
              <p className="text-xs text-slate-500 mb-1">Poddle account to connect</p>
              <p className="font-semibold text-slate-900 break-all">{user.email || user.id}</p>
            </div>
            <p className="text-sm text-slate-600 mb-5">By approving, you authorize Poddle to associate your Teams identity with this Poddle account. This does not grant access to Teams conversations or automatically upload messages.</p>
            <button type="button" disabled={busy} onClick={approve} className="w-full rounded-lg bg-blue-700 text-white px-5 py-3 font-semibold disabled:opacity-50">{busy ? 'Connecting…' : 'Approve connection'}</button>
            <button type="button" disabled={busy} onClick={() => { sessionStorage.removeItem(STORAGE_KEY); setToken(null); }} className="w-full mt-3 rounded-lg border border-slate-300 px-5 py-3 text-slate-700">Cancel</button>
          </div>
        )}
        {message && !connected && <p role="alert" className="text-sm text-red-700 mt-4">{message}</p>}
      </section>
    </main>
  );
}
