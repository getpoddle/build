import { useState, type FormEvent } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { getTeamsSDK } from '../lib/teamsAuth';

type Mode = 'signin' | 'signup' | 'forgot';

export default function TeamsTabSignIn() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const changeMode = (next: Mode) => {
    setMode(next);
    setError('');
    setMessage('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      if (mode === 'signin') {
        const { error: authError } = await signIn(email.trim(), password);
        if (authError) throw authError;
        // AuthContext updates the session; App.tsx then renders the full app.
      } else if (mode === 'signup') {
        if (!firstName.trim() || !lastName.trim() || !username.trim()) {
          throw new Error('Please complete all registration fields.');
        }
        if (password.length < 8) throw new Error('Use a password of at least 8 characters.');
        const { data: available, error: availabilityError } = await supabase.rpc('check_username_available', {
          p_username: username.trim(),
        });
        if (availabilityError) throw availabilityError;
        if (!available) throw new Error('This username is unavailable. Please choose another.');
        const { error: signupError } = await signUp(
          email.trim(), password, firstName.trim(), lastName.trim(), username.trim(),
        );
        if (signupError) throw signupError;
        setMessage('Account created. Check your email to confirm your address, then sign in here.');
        setPassword('');
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (resetError) throw resetError;
        setMessage('If an account exists for that email, a password-reset link has been sent.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const microsoftSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const sdk = await getTeamsSDK();
      const response = await sdk.authentication.authenticate({
        url: `${window.location.origin}/teams/auth-popup`,
        width: 620,
        height: 720,
      });
      const parsed: unknown = JSON.parse(response);
      if (!parsed || typeof parsed !== 'object' ||
          !('access_token' in parsed) || !('refresh_token' in parsed) ||
          typeof parsed.access_token !== 'string' || typeof parsed.refresh_token !== 'string') {
        throw new Error('Microsoft sign-in did not return a valid Poddle session.');
      }
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: parsed.access_token,
        refresh_token: parsed.refresh_token,
      });
      if (sessionError) throw sessionError;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in with Microsoft.');
    } finally {
      setBusy(false);
    }
  };

  const fieldClass = 'w-full rounded-lg border border-slate-300 px-3 py-2.5 text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Poddle AI</h1>
          <p className="text-sm text-slate-600 mt-2">Your decisions, inside Microsoft Teams</p>
        </div>
        <div className="flex gap-2 mb-6" role="group" aria-label="Account access">
          <button type="button" onClick={() => changeMode('signin')} className={`flex-1 rounded-lg py-2 font-medium ${mode === 'signin' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}>Sign in</button>
          <button type="button" onClick={() => changeMode('signup')} className={`flex-1 rounded-lg py-2 font-medium ${mode === 'signup' ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-700'}`}>Create account</button>
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-4">{mode === 'signup' ? 'Create your Poddle account' : mode === 'forgot' ? 'Reset your password' : 'Welcome back'}</h2>
        {error && <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {message && <p role="status" className="mb-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-800">{message}</p>}
        <form onSubmit={submit} className="space-y-3">
          {mode === 'signup' && <>
            <label className="block text-sm font-medium text-slate-700">First name<input className={`${fieldClass} mt-1`} value={firstName} onChange={e => setFirstName(e.target.value)} autoComplete="given-name" required /></label>
            <label className="block text-sm font-medium text-slate-700">Last name<input className={`${fieldClass} mt-1`} value={lastName} onChange={e => setLastName(e.target.value)} autoComplete="family-name" required /></label>
            <label className="block text-sm font-medium text-slate-700">Username<input className={`${fieldClass} mt-1`} value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" minLength={3} required /></label>
          </>}
          <label className="block text-sm font-medium text-slate-700">Email<input type="email" className={`${fieldClass} mt-1`} value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
          {mode !== 'forgot' && <label className="block text-sm font-medium text-slate-700">Password<input type="password" className={`${fieldClass} mt-1`} value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={mode === 'signup' ? 8 : undefined} required /></label>}
          <button type="submit" disabled={busy} className="w-full rounded-lg bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Please wait…' : mode === 'signup' ? 'Create account' : mode === 'forgot' ? 'Send reset link' : 'Sign in to Poddle'}</button>
        </form>
        {mode === 'signin' && <button type="button" className="mt-3 text-sm text-blue-700 hover:underline" onClick={() => changeMode('forgot')}>Forgot password?</button>}
        {mode === 'forgot' && <button type="button" className="mt-3 text-sm text-blue-700 hover:underline" onClick={() => changeMode('signin')}>Back to sign in</button>}
        {mode !== 'forgot' && <>
          <div className="my-5 flex items-center gap-3 text-sm text-slate-500"><span className="h-px flex-1 bg-slate-200" />or<span className="h-px flex-1 bg-slate-200" /></div>
          <button type="button" onClick={microsoftSignIn} disabled={busy} className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">Continue with Microsoft</button>
        </>}
      </div>
    </div>
  );
}
