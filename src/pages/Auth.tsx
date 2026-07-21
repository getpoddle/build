import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, ArrowLeft, User, AtSign, Eye, EyeOff } from 'lucide-react';
import PoddleMark from '../components/PoddleMark';
import { supabase } from '../lib/supabase';

type View = 'signin' | 'signup' | 'forgot';

export default function Auth() {
  const { signIn, signUp, signInWithGoogle, oauthError, clearOauthError } = useAuth();
  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [usernameSuggestions, setUsernameSuggestions] = useState<string[]>([]);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resetCooldownUntil, setResetCooldownUntil] = useState(0);

  useEffect(() => {
    if (oauthError) {
      setError(oauthError);
      clearOauthError();
    }
  }, [oauthError, clearOauthError]);

  const checkUsernameAvailability = async (usernameToCheck: string) => {
    if (!usernameToCheck || usernameToCheck.length < 3) return;

    setCheckingUsername(true);
    setUsernameSuggestions([]);

    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        p_username: usernameToCheck
      });

      if (error) throw error;

      if (!data) {
        const { data: suggestions } = await supabase.rpc('suggest_usernames', {
          p_first_name: firstName || 'user',
          p_last_name: lastName || '',
          p_desired_username: usernameToCheck
        });

        if (suggestions) {
          setUsernameSuggestions(suggestions);
        }
      }
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setUsernameSuggestions([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (view === 'forgot') {
        const now = Date.now();
        if (now < resetCooldownUntil) {
          const secsLeft = Math.ceil((resetCooldownUntil - now) / 1000);
          setError(`Please wait ${secsLeft} seconds before requesting another reset link.`);
          setLoading(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
        const res = await fetch(`${supabaseUrl}/functions/v1/send-password-reset`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${anonKey}`,
          },
          body: JSON.stringify({
            email,
            redirectTo: window.location.origin,
          }),
        });

        const data = await res.json();

        if (res.status === 429) {
          setError('Too many requests. Please wait before trying again.');
        } else if (!res.ok || data.error) {
          setError(data.error || 'Something went wrong. Please try again.');
        } else {
          setResetCooldownUntil(Date.now() + 60_000);
          setSuccessMessage('If an account exists for that email, a reset link has been sent. Check your inbox.');
        }
      } else if (view === 'signup') {
        if (!username) {
          setError('Username is required');
          setLoading(false);
          return;
        }

        const { data: isAvailable } = await supabase.rpc('check_username_available', {
          p_username: username
        });

        if (!isAvailable) {
          setError('Username is already taken. Please choose another one.');
          setLoading(false);
          return;
        }

        const { error } = await signUp(email, password, firstName, lastName, username);

        if (error) {
          setError(error.message);
        }
      } else {
        const { error } = await signIn(email, password);

        if (error) {
          setError(error.message);
        }
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const switchView = (next: View) => {
    setError('');
    setSuccessMessage('');
    setView(next);
  };

  return (
    <div
      className="min-h-screen flex items-start sm:items-center justify-center px-4 py-8 sm:py-4 relative overflow-hidden"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 2rem)', background: 'var(--app-bg)' }}
    >
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl floating pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(184,134,11,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl floating pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(184,134,11,0.04) 0%, transparent 70%)', animationDelay: '1.5s' }} />

      <div className="max-w-md w-full relative z-10 scale-in">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2.5 mb-3 sm:mb-4 floating">
            <PoddleMark size={40} />
            <h1 className="text-3xl sm:text-5xl font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>Poddle AI</h1>
          </div>
          <p className="text-sm sm:text-base font-semibold" style={{ color: 'var(--app-text-secondary)' }}>
            Judgement infrastructure for high-stakes decisions
          </p>
        </div>

        <div className="panel-raised p-5 sm:p-8" style={{ boxShadow: 'var(--shadow-xl)' }}>
          {view === 'forgot' && (
            <button
              onClick={() => switchView('signin')}
              className="btn-ghost mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>
          )}

          <h2 className="display-heading text-2xl sm:text-3xl mb-1.5">
            {view === 'signup' ? 'Create Account' : view === 'forgot' ? 'Reset Password' : 'Welcome Back'}
          </h2>
          {view === 'forgot' ? (
            <p className="text-sm mb-5 font-medium" style={{ color: 'var(--app-text-secondary)' }}>
              Enter your email and we'll send you a link to reset your password.
            </p>
          ) : (
            <p className="text-sm mb-5 font-medium" style={{ color: 'var(--app-text-secondary)' }}>
              {view === 'signup' ? 'Join the community and start collaborating' : 'Continue your journey'}
            </p>
          )}

          {error && (
            <div className="mb-4 p-3 text-sm" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 text-sm" style={{ background: 'var(--positive-bg)', border: '1px solid var(--positive)', color: 'var(--positive)' }}>
              {successMessage}
            </div>
          )}

          {view !== 'forgot' && (
            <div className="mt-4">
              <button
                type="button"
                onClick={async () => {
                  setError('');
                  setLoading(true);
                  const { error } = await signInWithGoogle();
                  if (error) {
                    setError(error.message);
                    setLoading(false);
                  }
                }}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 py-3 px-4 rounded-lg border transition-all hover:bg-[var(--app-hover)] disabled:opacity-60 disabled:cursor-not-allowed"
                style={{ borderColor: 'var(--app-border)', background: 'var(--app-surface)', color: 'var(--app-text-primary)', fontSize: '0.9375rem', fontWeight: 600 }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3 my-4">
                <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
                <span className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--app-text-muted)' }}>or continue with email</span>
                <div className="flex-1 h-px" style={{ background: 'var(--app-border)' }} />
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {view === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--app-text-primary)' }}>
                      First Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
                      <input
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="input-modern pl-9"
                        placeholder="John"
                        required
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--app-text-primary)' }}>
                      Last Name
                    </label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--app-text-muted)' }} />
                      <input
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="input-modern pl-9"
                        placeholder="Doe"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--app-text-primary)' }}>
                    Username
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => handleUsernameChange(e.target.value)}
                      onBlur={() => checkUsernameAvailability(username)}
                      className="input-modern pl-10"
                      placeholder="johndoe"
                      pattern="[a-zA-Z0-9_-]{3,30}"
                      title="3-30 characters: letters, numbers, underscore, and dash only"
                      required
                    />
                  </div>
                  {checkingUsername && (
                    <p className="text-xs mt-1" style={{ color: 'var(--app-text-muted)' }}>Checking availability...</p>
                  )}
                  {usernameSuggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs mb-1" style={{ color: 'var(--app-text-secondary)' }}>Username taken. Try these:</p>
                      <div className="flex flex-wrap gap-2">
                        {usernameSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setUsername(suggestion);
                              setUsernameSuggestions([]);
                            }}
                            className="text-xs px-2 py-1 transition-colors"
                            style={{ background: 'var(--signal-bg)', color: 'var(--signal)' }}
                          >
                            @{suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium mb-2" style={{ color: 'var(--app-text-primary)' }}>
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-modern pl-10"
                  placeholder="you@example.com"
                  required
                />
              </div>
            </div>

            {view !== 'forgot' && (
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium" style={{ color: 'var(--app-text-primary)' }}>
                    Password
                  </label>
                  {view === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className="text-xs font-medium transition-colors text-signal"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: 'var(--app-text-muted)' }} />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-modern pl-10 pr-11"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: 'var(--app-text-muted)' }}
                    tabIndex={-1}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full"
              style={{ padding: '0.875rem 1.25rem', fontSize: '0.9375rem' }}
            >
              {loading
                ? 'Loading...'
                : view === 'signup'
                ? 'Create Account'
                : view === 'forgot'
                ? 'Send Reset Link'
                : 'Sign In'}
            </button>
          </form>

          {view !== 'forgot' && (
            <div className="mt-6 pt-6" style={{ borderTop: '1px solid var(--app-border)' }}>
              <p className="text-center font-medium text-sm" style={{ color: 'var(--app-text-secondary)' }}>
                {view === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={() => switchView(view === 'signup' ? 'signin' : 'signup')}
                  className="font-bold text-signal"
                >
                  {view === 'signup' ? 'Sign In' : 'Sign Up'}
                </button>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
