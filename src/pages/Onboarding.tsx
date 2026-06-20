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
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent" />
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 rounded-full blur-3xl floating" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-blue-400/20 to-cyan-500/20 rounded-full blur-3xl floating" style={{ animationDelay: '1.5s' }} />

      <div className="max-w-lg w-full relative z-10">
        <div className="text-center mb-8 fade-in">
          <div className="inline-flex items-center gap-3 mb-6 floating">
            <PoddleMark size={48} />
            <h1 className="text-4xl sm:text-5xl font-black tracking-tight" style={{ color: '#0f172a' }}>Poddle</h1>
          </div>
          <p className="text-lg text-slate-600 font-semibold">AI-powered decision intelligence for teams</p>
        </div>

        <div className="glass-card-strong rounded-3xl shadow-2xl p-6 sm:p-10 border scale-in">
          {/* Progress bar */}
          <div className="flex gap-2 mb-8">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-2 flex-1 rounded-full transition-all duration-500 ${
                  i <= currentStepIndex
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-600 shadow-sm'
                    : 'bg-slate-200'
                }`}
              />
            ))}
          </div>

          {/* Step 0: Name completion (only if needed) */}
          {step === 0 && needsNameUpdate && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-3">
                <UserIcon className="w-7 h-7 text-blue-600" />
                <h2 className="text-2xl font-bold text-slate-900">Complete Your Profile</h2>
              </div>
              <p className="text-slate-500 mb-8">Please add your name to continue.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    placeholder="John"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    placeholder="Doe"
                    className="w-full px-4 py-3 border-2 border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900"
                  />
                </div>
              </div>

              <button
                onClick={handleNameUpdate}
                disabled={!firstName.trim() || !lastName.trim() || loading}
                className="w-full mt-8 gradient-primary btn-primary py-4 text-white font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none"
              >
                {loading ? 'Saving...' : 'Continue'}
              </button>
            </div>
          )}

          {/* Step 1: Create first workspace */}
          {step === 1 && (
            <div className="animate-in fade-in slide-in-from-left-4 duration-500">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}>
                  <Lock className="w-4 h-4 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-slate-900">Create your first workspace</h2>
              </div>
              <p className="text-slate-500 mb-6 text-sm">A private space where your team collaborates with AI on decisions. Invite-only and never publicly discoverable.</p>

              {/* Trial banner */}
              {!loadingTrial && !isPro && !trialExhausted && (
                <div
                  className="mb-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
                  style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}
                >
                  <Clock className="w-4 h-4 flex-shrink-0 text-blue-600" />
                  <span className="text-slate-700">
                    <span className="font-bold text-blue-600">Free trial</span> — all Pro features unlocked for 7 days.{' '}
                    <span className="text-slate-500">
                      {trialSlotsRemaining === 1 ? '1 trial slot remaining.' : 'Both trial slots available.'}
                    </span>
                  </span>
                </div>
              )}

              {workspaceError && (
                <div className="mb-4 p-3 rounded-xl text-sm text-red-700 font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {workspaceError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Workspace Name</label>
                  <input
                    type="text"
                    value={workspaceName}
                    onChange={e => setWorkspaceName(e.target.value)}
                    placeholder="e.g. Product Roadmap Q3, Series A Strategy"
                    maxLength={60}
                    className="w-full px-4 py-3 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                    style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Description <span className="font-normal text-slate-400 normal-case">(optional)</span>
                  </label>
                  <textarea
                    value={workspaceDescription}
                    onChange={e => setWorkspaceDescription(e.target.value)}
                    placeholder="What decisions or challenges will this workspace focus on?"
                    rows={2}
                    maxLength={500}
                    className="w-full px-4 py-3 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
                    style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Domain</label>
                  <div className="relative">
                    <select
                      value={workspaceDomain}
                      onChange={e => setWorkspaceDomain(e.target.value)}
                      className="w-full px-4 py-3 pr-9 rounded-xl text-sm border text-slate-900 appearance-none focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                      style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
                    >
                      {DOMAINS.map(d => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <button
                onClick={handleCreateWorkspace}
                disabled={creating || !workspaceName.trim() || loadingTrial || skipWorkspace || !canCreate}
                className="w-full mt-6 py-4 rounded-xl text-white font-bold text-base flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 6px 18px rgba(37,99,235,0.3)' }}
              >
                {creating ? (
                  <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                className="w-full mt-3 py-2.5 text-sm text-slate-400 hover:text-slate-600 transition-colors disabled:opacity-50"
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
