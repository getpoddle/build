import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User as UserIcon, Loader2 } from 'lucide-react';
import PoddleMark from '../components/PoddleMark';
import { trackProfileCompleted } from '../lib/analytics';
import { phSyncProfileProperties } from '../lib/posthog';

interface OnboardingProps {
  onComplete: () => void;
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [needsNameUpdate, setNeedsNameUpdate] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);

  useEffect(() => {
    const checkProfileCompleteness = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('profiles')
        .select('first_name, last_name')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        const hasIncompleteName =
          !data.first_name || !data.last_name ||
          data.first_name.trim() === '' || data.last_name.trim() === '';

        if (hasIncompleteName) {
          setNeedsNameUpdate(true);
          setStep(0);
        } else {
          await redirectToWorkspace();
          return;
        }
      }
      setIsInitialized(true);
    };
    checkProfileCompleteness();
  }, [user]);

  const markOnboarded = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
    trackProfileCompleted(user.id);
    phSyncProfileProperties(user.id);
  };

  const redirectToWorkspace = async () => {
    if (!user) return;
    setRedirecting(true);

    try {
      const { data: workspace } = await supabase
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      await markOnboarded();

      if (workspace) {
        const hash = `#workspace/${workspace.id}`;
        window.location.hash = hash;
        sessionStorage.setItem('currentPage', 'workspace-hub');
      } else {
        sessionStorage.setItem('currentPage', 'workspaces');
      }
    } catch {
      sessionStorage.setItem('currentPage', 'workspaces');
    } finally {
      onComplete();
    }
  };

  const handleNameUpdate = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) return;
    setLoading(true);
    try {
      await supabase.from('profiles').update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
      }).eq('id', user.id);
      setNeedsNameUpdate(false);
      await redirectToWorkspace();
    } catch (err) {
      console.error('Error updating name:', err);
      setLoading(false);
    }
  };

  if (!isInitialized && !redirecting) return null;

  if (redirecting) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--app-bg)' }}>
        <div className="text-center">
          <div className="inline-flex items-center gap-3 mb-6 floating">
            <PoddleMark size={48} />
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>Poddle AI</h1>
          </div>
          <div className="flex items-center justify-center gap-3 mb-2">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--signal)' }} />
            <p className="text-sm font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Setting up your workspace...</p>
          </div>
          <p className="text-xs" style={{ color: 'var(--app-text-muted)' }}>Your AI Collaboration room is ready</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--app-bg)' }}>
      <div className="absolute top-0 right-0 w-96 h-96 rounded-full blur-3xl floating pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(184,134,11,0.06) 0%, transparent 70%)' }} />
      <div className="absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl floating pointer-events-none" style={{ background: 'radial-gradient(circle, rgba(184,134,11,0.04) 0%, transparent 70%)', animationDelay: '1.5s' }} />

      <div className="max-w-lg w-full relative z-10">
        <div className="text-center mb-8 fade-in">
          <div className="inline-flex items-center gap-3 mb-4 floating">
            <PoddleMark size={48} />
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight" style={{ color: 'var(--app-text-primary)' }}>Poddle AI</h1>
          </div>
          <p className="text-base font-semibold" style={{ color: 'var(--app-text-secondary)' }}>Judgement infrastructure for high-stakes decisions</p>
        </div>

        <div className="panel-raised p-6 sm:p-10 scale-in" style={{ boxShadow: 'var(--shadow-xl)' }}>
          <div className="flex gap-2 mb-8">
            <div className="h-2 flex-1 transition-all duration-500" style={{ background: 'var(--signal)' }} />
          </div>

          {step === 0 && needsNameUpdate && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-3">
                <UserIcon className="w-7 h-7" style={{ color: 'var(--signal)' }} />
                <h2 className="display-heading text-2xl">Complete Your Profile</h2>
              </div>
              <p className="mb-8" style={{ color: 'var(--app-text-secondary)' }}>Please add your name to continue.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="John"
                    className="input-modern"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="input-modern"
                  />
                </div>
              </div>

              <button
                onClick={handleNameUpdate}
                disabled={!firstName.trim() || !lastName.trim() || loading}
                className="btn-primary w-full mt-8"
                style={{ padding: '1rem 1.25rem', fontSize: '1rem' }}
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
