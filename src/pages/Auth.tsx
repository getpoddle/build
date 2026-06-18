import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Mail, Lock, ArrowLeft, User, AtSign } from 'lucide-react';
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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent"></div>
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-400/30 to-blue-500/30 rounded-full blur-3xl floating"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/30 to-cyan-500/30 rounded-full blur-3xl floating" style={{ animationDelay: '1.5s' }}></div>

      <div className="max-w-md w-full relative z-10 scale-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-3 mb-6">
            <div className="w-16 h-16 gradient-primary rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-500/30 floating">
              <Sparkles className="w-9 h-9 text-white" />
            </div>
            <h1 className="text-5xl font-bold gradient-text">
              Poddle
            </h1>
          </div>
          <p className="text-slate-600 text-lg font-semibold">
            Challenge assumptions. Make better calls.
          </p>
        </div>

        <div className="glass-card-strong rounded-3xl shadow-2xl p-8 border">
          {view === 'forgot' && (
            <button
              onClick={() => switchView('signin')}
              className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-5 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to sign in
            </button>
          )}

          <h2 className="text-3xl font-bold text-slate-900 mb-2">
            {view === 'signup' ? 'Create Account' : view === 'forgot' ? 'Reset Password' : 'Welcome Back'}
          </h2>
          {view === 'forgot' ? (
            <p className="text-sm text-slate-600 mb-6 font-medium">
              Enter your email and we'll send you a link to reset your password.
            </p>
          ) : (
            <p className="text-sm text-slate-600 mb-6 font-medium">
              {view === 'signup' ? 'Join the community and start collaborating' : 'Continue your journey'}
            </p>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            {view === 'signup' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input-modern pl-10"
                      placeholder="John"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input-modern pl-10"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Username
                  </label>
                  <div className="relative">
                    <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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
                    <p className="text-xs text-slate-500 mt-1">Checking availability...</p>
                  )}
                  {usernameSuggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-600 mb-1">Username taken. Try these:</p>
                      <div className="flex flex-wrap gap-2">
                        {usernameSuggestions.map((suggestion) => (
                          <button
                            key={suggestion}
                            type="button"
                            onClick={() => {
                              setUsername(suggestion);
                              setUsernameSuggestions([]);
                            }}
                            className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
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
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
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
                  <label className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  {view === 'signin' && (
                    <button
                      type="button"
                      onClick={() => switchView('forgot')}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="input-modern pl-10"
                    placeholder="••••••••"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full gradient-primary btn-primary py-3.5 text-white font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
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
            <div className="mt-6 pt-6 border-t border-slate-200">
              <p className="text-center text-slate-600 font-medium">
                {view === 'signup' ? 'Already have an account?' : "Don't have an account?"}{' '}
                <button
                  onClick={() => switchView(view === 'signup' ? 'signin' : 'signup')}
                  className="gradient-text font-bold hover:opacity-80 transition-opacity"
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
