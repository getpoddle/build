import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { User as UserIcon, Lock, ChevronDown, Clock } from 'lucide-react';
import PoddleMark from '../components/PoddleMark';
import { trackProfileCompleted } from '../lib/analytics';
import { phSyncProfileProperties } from '../lib/posthog';
import { useSubscriptionTier, useTrialInfo } from '../hooks/useWorkspaceAccess';

interface OnboardingProps {
  onComplete: () => void;
}

const DOMAINS = [
  { value: 'technology', label: 'Technology' },
  { value: 'business', label: 'Business Strategy' },
  { value: 'finance', label: 'Finance' },
  { value: 'product_development', label: 'Product Development' },
  { value: 'startup_ops', label: 'Startup Operations' },
  { value: 'ai_product', label: 'AI & Machine Learning' },
  { value: 'health', label: 'Health & Life Sciences' },
  { value: 'science', label: 'Science & Research' },
  { value: 'entrepreneurship', label: 'Entrepreneurship' },
  { value: 'general', label: 'General' },
];

async function callCreateWorkspace(accessToken: string, payload: Record<string, unknown>) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/create-workspace`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
  return res.json();
}

export default function Onboarding({ onComplete }: OnboardingProps) {
  const { user } = useAuth();
  const { isPro, loading: tierLoading } = useSubscriptionTier();
  const { trialExhausted, trialSlotsRemaining, loading: trialLoading } = useTrialInfo();

  // step 0 = name completion (conditional), step 1 = create workspace
  const [step, setStep] = useState(1);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [needsNameUpdate, setNeedsNameUpdate] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [loading, setLoading] = useState(false);

  // Workspace creation state
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [workspaceDomain, setWorkspaceDomain] = useState('general');
  const [creating, setCreating] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [skipWorkspace, setSkipWorkspace] = useState(false);

  const loadingTrial = tierLoading || trialLoading;
  const canCreate = isPro || !trialExhausted;

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
        }
      }
      setIsInitialized(true);
    };
    checkProfileCompleteness();
  }, [user]);

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
      setStep(1);
    } catch (err) {
      console.error('Error updating name:', err);
    } finally {
      setLoading(false);
    }
  };

  const markOnboarded = async () => {
    if (!user) return;
    await supabase.from('profiles').update({ onboarded: true }).eq('id', user.id);
    trackProfileCompleted(user.id);
    phSyncProfileProperties(user.id);
  };

  const handleCreateWorkspace = async () => {
    if (!user || !workspaceName.trim()) {
      setWorkspaceError('Workspace name is required.');
      return;
    }
    setCreating(true);
    setWorkspaceError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setWorkspaceError('Session expired. Please sign in again.');
        return;
      }
      const json = await callCreateWorkspace(session.access_token, {
        name: workspaceName.trim(),
        description: workspaceDescription.trim(),
        domain: workspaceDomain,
        plan: 'pro',
      });
      if (json.error) {
        setWorkspaceError(json.error);
        return;
      }
      await markOnboarded();
      onComplete();
    } catch {
      setWorkspaceError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = async () => {
    setSkipWorkspace(true);
    await markOnboarded();
    onComplete();
  };

  if (!isInitialized) return null;

  const totalSteps = needsNameUpdate ? 2 : 1;
  const currentStepIndex = step === 0 ? 0 : 1;

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
          {/* Progress bar */}
          <div className="flex gap-2 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className="h-2 flex-1 transition-all duration-500"
                style={i <= currentStepIndex
                  ? { background: 'var(--signal)' }
                  : { background: 'var(--app-border)' }
                }
              />
            ))}
          </div>

          {/* Step 0: Name completion (only if needed) */}
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

          {/* Step 1: Create first workspace */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 flex items-center justify-center" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>
                  <Lock className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                </div>
                <h2 className="display-heading text-2xl">Create your first workspace</h2>
              </div>
              <p className="mb-6 text-sm" style={{ color: 'var(--app-text-secondary)' }}>A private space where your team collaborates with AI on decisions. Invite-only and never publicly discoverable.</p>

              {/* Trial banner */}
              {!loadingTrial && !isPro && !trialExhausted && (
                <div
                  className="mb-5 flex items-center gap-2.5 px-4 py-3 text-sm"
                  style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
                >
                  <Clock className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--signal)' }} />
                  <span style={{ color: 'var(--app-text-secondary)' }}>
                    <span className="font-bold text-signal">Free trial</span> — all Pro features unlocked for 7 days.{' '}
                    <span style={{ color: 'var(--app-text-muted)' }}>
                      {trialSlotsRemaining === 1 ? '1 trial slot remaining.' : 'Both trial slots available.'}
                    </span>
                  </span>
                </div>
              )}

              {workspaceError && (
                <div className="mb-4 p-3 text-sm font-medium" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)', color: 'var(--negative)' }}>
                  {workspaceError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--app-text-primary)' }}>Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Product Roadmap Q3, Series A Strategy"
                    maxLength={60}
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--app-text-primary)' }}>
                    Description <span className="font-normal normal-case" style={{ color: 'var(--app-text-muted)' }}>(optional)</span>
                  </label>
                  <textarea
                    value={workspaceDescription}
                    onChange={e => setWorkspaceDescription(e.target.value)}
                    placeholder="What decisions or challenges will this workspace focus on?"
                    rows={2}
                    maxLength={500}
                    className="input-modern"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold mb-1.5 uppercase tracking-wide" style={{ color: 'var(--app-text-primary)' }}>Domain</label>
                  <div className="relative">
                    <select
                      value={workspaceDomain}
                      onChange={e => setWorkspaceDomain(e.target.value)}
                      className="input-modern pr-9"
                    >
                      {DOMAINS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: 'var(--app-text-muted)' }} />
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateWorkspace}
                disabled={creating || !workspaceName.trim() || loadingTrial || skipWorkspace || !canCreate}
                className="btn-primary w-full mt-6"
                style={{ padding: '1rem 1.25rem', fontSize: '0.9375rem' }}
              >
                {creating ? (
                  <span className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--ink-900)', borderTopColor: 'transparent' }} />
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Create Workspace & Get Started
                  </>
                )}
              </button>

              <button
                onClick={handleSkip}
                disabled={creating || skipWorkspace}
                className="w-full mt-3 py-2.5 text-sm transition-colors"
                style={{ color: 'var(--app-text-muted)' }}
              >
                Skip for now
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
