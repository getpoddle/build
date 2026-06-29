import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getDisplayName } from '../lib/displayName';
import { setUserProperties, trackUserLogin, trackUserSignup } from '../lib/analytics';
import { phIdentify, phSetPersonProperties, phReset, phCapture, phSyncProfileProperties } from '../lib/posthog';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const IDLE_EVENTS = ['mousemove', 'keydown', 'click', 'touchstart'] as const;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  clearPasswordRecovery: () => void;
  signupEmailPending: string | null;
  clearSignupEmailPending: () => void;
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
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [signupEmailPending, setSignupEmailPending] = useState<string | null>(null);
  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAdminRef = useRef(false);

  const clearIdleTimer = () => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = null;
    }
  };

  const resetIdleTimer = () => {
    if (!isAdminRef.current) return;
    clearIdleTimer();
    idleTimerRef.current = setTimeout(() => {
      supabase.auth.signOut({ scope: 'global' });
    }, IDLE_TIMEOUT_MS);
  };

  // Start/stop idle detection based on admin status
  useEffect(() => {
    IDLE_EVENTS.forEach(e => window.addEventListener(e, resetIdleTimer, { passive: true }));
    return () => {
      IDLE_EVENTS.forEach(e => window.removeEventListener(e, resetIdleTimer));
      clearIdleTimer();
    };
  }, []);

  useEffect(() => {
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
    }, 8000);

    supabase.auth.getSession().then(({ data: { session } }) => {
      clearTimeout(loadingTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    }).catch(() => {
      clearTimeout(loadingTimeout);
      setLoading(false);
    });

    const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> =>
      Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))]);

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
        try {
          if (event === 'PASSWORD_RECOVERY') {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
            setIsPasswordRecovery(true);
            return;
          }

          setSession(session);
          setUser(session?.user ?? null);
          setLoading(false);

          if (event === 'USER_UPDATED' && session?.user?.email_confirmed_at) {
            setSignupEmailPending(null);
          }

          if (event === 'SIGNED_IN' && session?.user) {
            phIdentify(session.user.id, {
              email: session.user.email,
              signup_at: session.user.created_at,
            });

            // Run admin check and profile fetch in parallel
            let profile: { id: string; first_name: string | null; last_name: string | null; username: string | null } | null = null;
            try {
              const [adminRes, profileRes] = await Promise.all([
                withTimeout(
                  supabase.from('admins').select('id').eq('id', session.user.id).maybeSingle(),
                  5000
                ).catch(() => ({ data: null })),
                withTimeout(
                  supabase.from('profiles').select('id, first_name, last_name, username').eq('id', session.user.id).maybeSingle(),
                  5000
                ),
              ]);
              isAdminRef.current = !!adminRes.data;
              if (isAdminRef.current) resetIdleTimer();
              profile = profileRes.data;
            } catch {
              console.error('Profile fetch timed out');
              return;
            }

            if (!profile) {
              // Guard against deleted accounts: if the auth account is older than
              // 10 minutes but has no profile, the user was deleted by an admin.
              // Sign them out immediately instead of recreating their profile.
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

              try {
                const { error: insertErr } = await withTimeout(
                  supabase.from('profiles').insert({
                    id: session.user.id,
                    email: session.user.email!,
                    first_name: session.user.user_metadata?.first_name || null,
                    last_name: session.user.user_metadata?.last_name || null,
                    username: session.user.user_metadata?.username || null,
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

  const signUp = async (email: string, password: string, firstName: string, lastName: string, username: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          first_name: firstName,
          last_name: lastName,
          username: username,
          full_name: `${firstName} ${lastName}`,
        },
      },
    });
    if (!error && data.user) {
      trackUserSignup('email');
      setSignupEmailPending(email);
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      fetch(`${supabaseUrl}/functions/v1/send-signup-confirmation`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${anonKey}`,
        },
        body: JSON.stringify({
          userId: data.user.id,
          redirectTo: window.location.origin,
        }),
      }).catch(() => {});
    }
    return { error };
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
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    return { error };
  };

  const signOut = async () => {
    try {
      isAdminRef.current = false;
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
