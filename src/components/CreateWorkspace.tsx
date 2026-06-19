import { useState } from 'react';
import { X, Lock, Sparkles, ChevronDown, Clock } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useSubscriptionTier, useTrialInfo } from '../hooks/useWorkspaceAccess';
import UpgradePrompt from './UpgradePrompt';

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

interface CreateWorkspaceProps {
  onClose: () => void;
  onCreated: (workspaceId: string) => void;
  onNavigatePricing: () => void;
  initialName?: string;
  initialDescription?: string;
}

export default function CreateWorkspace({ onClose, onCreated, onNavigatePricing, initialName = '', initialDescription = '' }: CreateWorkspaceProps) {
  const { user } = useAuth();
  const { isPro, loading: tierLoading } = useSubscriptionTier();
  const { trialExhausted, trialSlotsRemaining, loading: trialLoading } = useTrialInfo();
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription);
  const [domain, setDomain] = useState('general');
  const [plan, setPlan] = useState<'pro' | 'team'>('pro');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const loading = tierLoading || trialLoading;
  // Free users can create if they have trial slots remaining
  const canCreate = isPro || (!trialExhausted);

  async function handleCreate() {
    if (!user) return;
    if (!name.trim()) { setError('Workspace name is required.'); return; }

    setCreating(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setError('Session expired. Please sign in again.');
        return;
      }

      const json = await callCreateWorkspace(session.access_token, {
        name: name.trim(),
        description: description.trim(),
        domain,
        plan,
      });

      if (json.errorCode === 'TRIAL_EXHAUSTED') {
        setShowUpgrade(true);
        return;
      }

      if (json.error) {
        setError(json.error);
        return;
      }

      onCreated(json.workspace.id);
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  async function handleCheckout() {
    if (!user) return;

    setCreating(true);
    setError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          plan,
          workspace_name: name.trim() || 'My Workspace',
          seats: plan === 'team' ? 10 : 5,
          success_url: `${window.location.origin}/?payment_success=1&plan=${plan}`,
          cancel_url: window.location.href,
        }),
      });

      const json = await res.json();

      if (json.url) {
        window.location.href = json.url;
      } else {
        setError(json.error || 'Failed to start checkout.');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setCreating(false);
    }
  }

  if (showUpgrade) {
    return (
      <UpgradePrompt
        context="trial_exhausted"
        onClose={() => setShowUpgrade(false)}
        onUpgrade={() => { setShowUpgrade(false); onNavigatePricing(); }}
      />
    );
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-lg w-full overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 32px 80px rgba(15,23,42,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="px-8 pt-7 pb-5 flex items-start justify-between"
          style={{ borderBottom: '1px solid rgba(15,23,42,0.07)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-2xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)' }}
            >
              <Lock className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900">New Private Workspace</h2>
              <p className="text-xs text-slate-500 mt-0.5">Encrypted. Invite-only. Never publicly discoverable.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Trial banner for free users */}
        {!loading && !isPro && !trialExhausted && (
          <div
            className="mx-8 mt-5 flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm"
            style={{ background: 'rgba(37,99,235,0.06)', border: '1px solid rgba(37,99,235,0.15)' }}
          >
            <Clock className="w-4 h-4 flex-shrink-0" style={{ color: '#2563eb' }} />
            <span className="text-slate-700">
              <span className="font-bold" style={{ color: '#2563eb' }}>Free trial workspace</span>
              {' '}— all Pro features unlocked for 7 days.{' '}
              <span className="text-slate-500">
                {trialSlotsRemaining === 1 ? '1 trial slot remaining.' : 'Both trial slots available.'}
              </span>
            </span>
          </div>
        )}

        {/* Form */}
        <div className="px-8 py-6 space-y-5">
          {error && (
            <div className="p-3 rounded-xl text-sm text-red-700 font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Workspace Name</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Series A Strategy, Product Roadmap Q3"
              maxLength={60}
              className="w-full px-4 py-3 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Description <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What decisions or ideas will this workspace focus on?"
              rows={3}
              maxLength={500}
              className="w-full px-4 py-3 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Domain</label>
              <div className="relative">
                <select
                  value={domain}
                  onChange={e => setDomain(e.target.value)}
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

          {/* Plan toggle */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Plan</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { value: 'pro', label: 'Pro Individual', seats: 3, desc: 'Up to 3 members' },
                { value: 'team', label: 'Poddle Team', seats: 10, desc: 'Up to 10 members' },
              ] as const).map(p => (
                <button
                  key={p.value}
                  onClick={() => setPlan(p.value)}
                  className="flex flex-col items-start p-3.5 rounded-xl border text-left transition-all"
                  style={{
                    borderColor: plan === p.value ? '#2563eb' : 'rgba(15,23,42,0.12)',
                    background: plan === p.value ? 'rgba(37,99,235,0.06)' : '#fafafa',
                  }}
                >
                  <span className="text-sm font-bold text-slate-900">{p.label}</span>
                  <span className="text-xs text-slate-500 mt-0.5">{p.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div
          className="px-8 pb-7 flex gap-3"
          style={{ borderTop: '1px solid rgba(15,23,42,0.07)', paddingTop: '1.25rem' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-semibold border text-slate-700 hover:bg-slate-50 transition-colors"
            style={{ borderColor: 'rgba(15,23,42,0.12)' }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              if (!loading && !canCreate) {
                setShowUpgrade(true);
              } else {
                handleCreate();
              }
            }}
            disabled={creating || !name.trim() || loading}
            className="flex-1 py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:translate-y-0"
            style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 6px 18px rgba(37,99,235,0.3)' }}
          >
            {creating || loading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Lock className="w-4 h-4" />
                {canCreate ? 'Create Workspace' : 'Upgrade to Create'}
              </>
            )}
          </button>
        </div>

        {/* Checkout link for paid plan */}
        {!loading && !isPro && canCreate && (
          <div className="px-8 pb-5 text-center">
            <button
              onClick={handleCheckout}
              className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
            >
              Or upgrade now for unlimited workspaces
            </button>
          </div>
        )}
      </div>
    </div>
  );
}