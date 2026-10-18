import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { getTeamsSDK } from '../lib/teamsAuth';

export default function TeamsTabSignIn() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handleSignIn = async () => {
    setBusy(true);
    setError('');
    try {
      const sdk = await getTeamsSDK();
      const result = await sdk.authentication.authenticate({
        url: `${window.location.origin}/teams/auth-popup`,
        width: 620,
        height: 720,
      });
      const parsed: unknown = JSON.parse(result);
      if (!parsed || typeof parsed !== 'object' || !('access_token' in parsed) || !('refresh_token' in parsed) ||
        typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') {
        throw new Error('Sign-in did not return a valid session');
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });
      if (sessionError) throw sessionError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
    <div className="max-w-lg w-full rounded-xl bg-white shadow p-8 text-center">
      <h1 className="text-2xl font-bold mb-3">Poddle for Microsoft Teams</h1>
      <p className="text-slate-600 mb-6">Sign in using your existing Poddle email and password or your Microsoft account.</p>
      <button type="button" onClick={handleSignIn} disabled={busy} className="rounded-lg bg-blue-700 text-white px-5 py-3 font-semibold disabled:opacity-50">{busy ? 'Opening sign-in…' : 'Sign in to Poddle'}</button>
      {error && <p role="alert" className="mt-4 text-red-700">{error}</p>}
    </div>
  </div>;
}
