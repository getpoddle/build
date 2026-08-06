import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, isInitialPasswordRecovery, oauthRedirectCode } from '../lib/supabase';
import { getDisplayName } from '../lib/displayName';
import { setUserProperties, trackUserLogin, trackUserSignup } from '../lib/analytics';
import { phIdentify, phSetPersonProperties, phReset, phCapture, phSyncProfileProperties } from '../lib/posthog';

const IDLE_TIMEOUT_ADMIN = 8 * 60 * 60 * 1000;  // 8 hours for admins
const IDLE_TIMEOUT_USER  = 8 * 60 * 60 * 1000;  // 8 hours for regular users
const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'] as const;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signupEmailPending: string | null;
  clearSignupEmailPending: () => void;
  oauthError: string | null;
  clearOauthError: () => void;
  pendingDeletion: boolean;
  clearPendingDeletion: () => void;
  signUp: (email: string, password: string, firstName: string, lastName: string, username: string) => Promise<{ error: AuthError | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signInWithGoogle: () => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
  resendConfirmation: (email: string) => Promise<{ error: AuthError | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(isInitialPasswordRecovery);
  const [signupEmailPending, setSignupEmailPending] = useState<string | null>(null);
  const [oauthError, setOauthError] = useState<string | null>(null);
  const [pendingDeletion, setPendingDeletion] = useState(false);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdminRef = useRef(false);
  const isLoggedInRef = useRef(false);
  const signInProcessedRef = useRef(false);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const resetIdleTimer = () => {
    if (!isLoggedInRef.current) return;
    clearIdleTimer();
    const timeout = isAdminRef.current ? IDLE_TIMEOUT_ADMIN : IDLE_TIMEOUT_USER;
    const scope = isAdminRef.current ? 'global' : 'local';
    idleTimerRef.current = setTimeout(() => {
      supabase.auth.signOut({ scope });
    }, timeout);
  };

  useEffect(() => {
    IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearIdleTimer();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    // Detect OAuth redirect: Supabase bounces back to the app with tokens in the
    // URL hash (implicit flow) or query string (PKCE). With PKCE (the default in
    // supabase-js v2), errors come back in the query string as ?error=...&error_description=...
    // We need to check both to surface provider errors to the user.
    const detectOAuthError = () => {
      const params = new URLSearchParams(window.location.search);
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const error = params.get('error_description') || params.get('error') ||
                    hashParams.get('error_description') || hashParams.get('error');
      if (error) {
        history.replaceState(null, '', window.location.pathname);
        return error;
      }
      return null;
    };

    const detectedError = detectOAuthError();
    if (detectedError) setOauthError(detectedError);

    // detectSessionInUrl: true handles PKCE code exchange and implicit-flow
    // hash token processing during _initialize(). The manual exchange that
    // was here caused a race condition — two concurrent exchanges for the
    // same one-time-use code, where neither reliably established the session
    // before getSession() ran. URL cleanup happens in onAuthStateChange.

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(loadingTimeout);
      isLoggedInRef.current = !!session?.user;
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) resetIdleTimer();
    }).catch(() => {
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        try {
          // Keep the Realtime WebSocket authenticated with the latest JWT.
          // supabase-js auto-refreshes the access token, but the Realtime layer
          // maintains its own connection and does not automatically pick up the
          // new token. Without this, channels silently stop delivering events
          // after the first JWT expires (~5-10 min), until the page is reloaded.
          if (session?.access_token) {
            supabase.realtime.setAuth(session.access_token);
          }

          if (event === 'PASSWORD_RECOVERY') {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            setIsPasswordRecovery(true);
            // Clean the recovery tokens from the URL
            if (window.location.pathname === '/reset-password' || window.location.hash) {
              history.replaceState(null, '', '/reset-password');
            }
            return;
          }

          isLoggedInRef.current = !!session?.user;
          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);

          if (!session?.user) {
            isAdminRef.current = false;
            signInProcessedRef.current = false;
            clearIdleTimer();
            setPendingDeletion(false);
          }

          if (event === 'USER_UPDATED' && session?.user?.email_confirmed_at) {
            setSignupEmailPending(null);
          }

          // Clean OAuth redirect code from the URL once the session is
          // established, so it doesn't linger in the address bar or get
          // captured by hash-based routing.
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user && oauthRedirectCode) {
            const url = new URL(window.location.href);
            url.searchParams.delete('code');
            window.history.replaceState(window.history.state, '', url.toString());
          }

          // INITIAL_SESSION fires when onAuthStateChange is registered and a
          // session already exists (e.g. the PKCE exchange completed during
          // _initialize() before the listener was attached). Treat it the
          // same as SIGNED_IN for profile creation and signup tracking.
          if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
            if (signInProcessedRef.current) return;
            signInProcessedRef.current = true;
            phIdentify(session.user.id, {
              email: session.user.email,
              signup_at: session.user.created_at,
            });

            // Run admin check and profile fetch in parallel
            let profile: { id: string; first_name: string | null; last_name: string | null; username: string | null } | null = null;
            let deletionRequested = false;
            let profileQueryErrored = false;
            try {
              const [adminRes, profileRes, sensitiveRes] = await Promise.all([
                withTimeout(
                  supabase.from('admins').select('id').eq('id', session.user.id).maybeSingle(),
                  5000
                ).catch(() => ({ data: null })),
                withTimeout(
                  supabase.from('profiles').select('id, first_name, last_name, username').eq('id', session.user.id).maybeSingle(),
                  5000
                ).catch((err: unknown) => {
                  console.error('Profile query failed during sign-in:', err);
                  profileQueryErrored = true;
                  return { data: null };
                }),
                withTimeout(
                  supabase.rpc('get_own_profile_sensitive').maybeSingle(),
                  5000
                ).catch(() => ({ data: null })),
              ]);
              isAdminRef.current = !!adminRes.data;
              resetIdleTimer();
              profile = profileRes.data;
              deletionRequested = !!sensitiveRes.data?.deletion_requested_at;
            } catch {
              console.error('Sign-in profile fetch failed');
              profileQueryErrored = true;
              resetIdleTimer();
            }

            setPendingDeletion(deletionRequested);

            if (!profile && !profileQueryErrored) {
              const accountAgeMs = Date.now() - new Date(session.user.created_at).getTime();
              if (accountAgeMs > 10 * 60 * 1000) {
                await supabase.auth.signOut({ scope: 'local' });
                return;
              }
            }

            if (!profile) {
              const fullName = getDisplayName({
                full_name: session.user.user_metadata?.full_name,
                first_name: session.user.user_metadata?.first_name,
                last_name: session.user.user_metadata?.last_name
              }) !== 'Anonymous'
                ? getDisplayName({
                    full_name: session.user.user_metadata?.full_name,
                    first_name: session.user.user_metadata?.first_name,
                    last_name: session.user.user_metadata?.last_name
                  })
                : session.user.email?.split('@')[0] || 'User';

              // Google doesn't always provide a username. Generate a safe one
              // from the email prefix so it passes the ^[a-zA-Z0-9_-]{3,30}$ check.
              const rawUsername = session.user.user_metadata?.username
                || session.user.email?.split('@')[0]?.replace(/[^a-zA-Z0-9_-]/g, '')?.slice(0, 30)
                || null;
              const safeUsername = rawUsername && rawUsername.length >= 3 ? rawUsername : null;

              try {
                const { error: insertErr } = await withTimeout(
                  supabase.from('profiles').insert({
                    id: session.user.id,
                    email: session.user.email!,
                    first_name: session.user.user_metadata?.first_name || null,
                    last_name: session.user.user_metadata?.last_name || null,
                    username: safeUsername,
                    full_name: fullName,
                    onboarded: false,
                  }),
                  5000
                );
                if (insertErr) {
                  console.error('Profile creation failed:', insertErr);
                  await supabase.auth.signOut({ scope: 'local' });
                  return;
                }
              } catch {
                console.error('Profile creation timed out');
                await supabase.auth.signOut({ scope: 'local' });
                return;
              }

              const referralCode = localStorage.getItem('poddle_referral');
              if (referralCode) {
                try {
                  const { data: referrer } = await supabase
                    .rpc('lookup_referral_code', { p_code: referralCode })
                    .maybeSingle();

                  if (referrer && referrer.user_id !== session.user.id) {
                    await supabase.from('referral_signups').insert({
                      referrer_id: referrer.user_id,
                      referred_id: session.user.id,
                      referral_code: referralCode,
                    });

                    await supabase.from('notifications').insert({
                      user_id: referrer.user_id,
                      type: 'referral',
                      content: `Someone joined Poddle using your invite link!`,
                      created_at: new Date().toISOString(),
                    });
                  }

                  localStorage.removeItem('poddle_referral');
                } catch (error) {
                  console.error('Error tracking referral:', error);
                }
              }

              trackUserSignup(session.user.app_metadata?.provider === 'google' ? 'google' : 'email');
            } else {
              trackUserLogin('email');
              setUserProperties({
                verified: profile.username ? true : false,
              });
              phSetPersonProperties({
                username: profile.username || null,
                first_name: profile.first_name || null,
                last_name: profile.last_name || null,
              });
              phCapture('user_login', { method: 'email' });
              phSyncProfileProperties(session.user.id);
            }
          }
        } catch (err) {
          console.error('onAuthStateChange handler error:', err);
        }
      })();
    });

    return () => {
      clearTimeout(loadingTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const clearPasswordRecovery = () => setIsPasswordRecovery(false);
  const clearSignupEmailPending = () => setSignupEmailPending(null);
  const clearOauthError = () => setOauthError(null);

  const signUp = async (email: string, password: string, firstName: string, lastName: string, username: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/signup-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email, password, firstName, lastName, username }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        return { error: { message: data.error || 'Sign up failed. Please try again.' } as any };
      }

      trackUserSignup('email');
      setSignupEmailPending(email);
      return { error: null };
    } catch {
      return { error: { message: 'Unable to reach the signup service. Please try again.' } as any };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error };
  };

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
      },
    });
    return { error };
  };

  const resendConfirmation = async (email: string) => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const res = await fetch(`${supabaseUrl}/functions/v1/send-signup-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { error: { message: data.error || 'Failed to resend confirmation email' } as any };
      }
      return { error: null };
    } catch {
      return { error: { message: 'Failed to resend confirmation email' } as any };
    }
  };

  const signOut = async () => {
    try {
      isAdminRef.current = false;
      signInProcessedRef.current = false;
      clearIdleTimer();
      phCapture('user_logout');
      phReset();
      sessionStorage.removeItem('pendingInviteToken');
      sessionStorage.removeItem('postLoginRedirect');
      localStorage.removeItem('poddle_referral');
      await supabase.auth.signOut({ scope: 'local' });
      setUser(null);
      setSession(null);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const value = {
    user,
    session,
    loading,
    isPasswordRecovery,
    clearPasswordRecovery,
    signupEmailPending,
    clearSignupEmailPending,
    oauthError,
    clearOauthError,
    pendingDeletion,
    clearPendingDeletion: () => setPendingDeletion(false),
    signUp,
    signIn,
    signInWithGoogle,
    signOut,
    resendConfirmation,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
