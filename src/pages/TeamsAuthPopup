import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Auth from './Auth';
import { getTeamsSDK } from '../lib/teamsAuth';

/** Opens in Teams' protected authentication popup; never puts tokens in the URL. */
export default function TeamsAuthPopup() {
  const { session, loading } = useAuth();
  const [error, setError] = useState('');
  useEffect(() => {
    if (loading || !session) return;
    let cancelled = false;
    (async () => {
      try {
        const sdk = await getTeamsSDK();
        if (cancelled) return;
        // The result travels through Teams' authentication popup channel, not a URL.
        sdk.authentication.notifySuccess(JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        }));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Unable to finish Teams sign-in');
      }
    })();
    return () => { cancelled = true; };
  }, [session, loading]);
  if (loading || session) return <div className="min-h-screen flex items-center justify-center p-6">Completing Poddle sign-in…{error && <p role="alert">{error}</p>}</div>;
  return <div><Auth />{error && <p role="alert">{error}</p>}</div>;
}
