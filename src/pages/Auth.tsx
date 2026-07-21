import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Mail, Lock, ArrowLeft, User, AtSign, Eye, EyeOff } from 'lucide-react';
import PoddleMark from '../components/PoddleMark';
import { supabase } from '../lib/supabase';

type View = 'signin' | 'signup' | 'forgot';

export default function Auth() {
  const { signIn, signUp } = useAuth();
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

          <form onSubmit={handleSubmit} className="space-y-3.5 mt-4">
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
