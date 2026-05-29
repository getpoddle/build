import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { getDisplayName } from '../lib/displayName';
import { setUserProperties, trackUserLogin, trackUserSignup } from '../lib/analytics';
import { phIdentify, phSetPersonProperties, phReset, phCapture, phSyncProfileProperties } from '../lib/posthog';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
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
      supabase.auth.signOut({ scope: 'local' });
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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      (async () => {
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

        if (event === 'SIGNED_IN' && session?.user) {
          // Check admin status and start idle timeout if admin
          const { data: adminData } = await supabase
            .from('admins')
            .select('id')
            .eq('id', session.user.id)
            .maybeSingle();
          isAdminRef.current = !!adminData;
          if (isAdminRef.current) resetIdleTimer();

          phIdentify(session.user.id, {
            email: session.user.email,
            signup_at: session.user.created_at,
          });

          const { data: profile } = await supabase
            .from('profiles')
            .select('id, first_name, last_name, username')
            .eq('id', session.user.id)
            .maybeSingle();

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

            await supabase.from('profiles').insert({
              id: session.user.id,
              email: session.user.email!,
              first_name: session.user.user_metadata?.first_name || null,
              last_name: session.user.user_metadata?.last_name || null,
              username: session.user.user_metadata?.username || null,
              full_name: fullName,
              onboarded: false,
            });

            const referralCode = localStorage.getItem('poddle_referral');
            if (referralCode) {
              try {
                const { data: referrer } = await supabase
                  .from('referral_codes')
                  .select('user_id')
                  .eq('code', referralCode)
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

  const signOut = async () => {
    try {
      isAdminRef.current = false;
      clearIdleTimer();
      phCapture('user_logout');
      phReset();
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
