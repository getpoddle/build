import { useState } from 'react';
import { Lock, Sparkles, ArrowRight, X, Shield, Users, Brain, CheckCircle, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface UpgradePromptProps {
  onClose?: () => void;
  onUpgrade: () => void;
  context?: 'workspace' | 'seats' | 'generic' | 'trial_exhausted';
  workspaceName?: string;
}

export default function UpgradePrompt({ onClose, onUpgrade, context = 'generic', workspaceName }: UpgradePromptProps) {
  const { user } = useAuth();
  const [view, setView] = useState<'main' | 'request' | 'done'>('main');
  const [plan, setPlan] = useState<'pro' | 'enterprise'>('pro');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const copy = {
    workspace: {
      headline: 'Private Workspaces are a Pro feature',
      sub: 'Create encrypted spaces where your team debates proprietary ideas with AI agents — completely private and invite-only.',
    },
    seats: {
      headline: `You've reached your seat limit`,
      sub: workspaceName
        ? `Upgrade ${workspaceName} to add more team members.`
        : 'Upgrade your plan to add more team members to this workspace.',
    },
    generic: {
      headline: 'Upgrade to Pro',
      sub: 'Unlock private workspaces, invite your team, and debate proprietary ideas with AI agents in a secure, encrypted space.',
    },
    trial_exhausted: {
      headline: "You've used both free trial workspaces",
      sub: 'Upgrade to Pro to create unlimited workspaces and keep all your data — your trial content is safe and will carry over.',
    },
  };

  const { headline, sub } = copy[context];
  const perks = [
    { icon: Lock, label: 'Encrypted private workspace' },
    { icon: Users, label: 'Invite-only team access' },
    { icon: Brain, label: 'AI agents debate your ideas' },
    { icon: Shield, label: 'Your IP stays private' },
  ];

  async function handleRequestUpgrade() {
    if (!user) return;
    setSubmitting(true);
    setError('');
    try {
      const { error: err } = await supabase.from('upgrade_requests').insert({
        user_id: user.id,
        requested_plan: plan,
        notes: notes.trim() || null,
        status: 'pending',
      });
      if (err) throw err;
      setView('done');
    } catch {
      setError('Failed to submit request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4"
      style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-3xl max-w-md w-full overflow-hidden animate-scale-in"
        style={{ boxShadow: '0 32px 80px rgba(15,23,42,0.25)' }}
        onClick={e => e.stopPropagation()}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* ── DONE state ── */}
        {view === 'done' && (
          <>
            <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(160deg,#15803d 0%,#166534 100%)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.15)' }}>
                <CheckCircle className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Request submitted!</h2>
              <p className="text-sm text-green-100 leading-relaxed">Our team will review your upgrade request and get back to you shortly.</p>
            </div>
            <div className="px-8 py-6">
              <button
                onClick={onClose}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm transition-all hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#15803d,#16a34a)', boxShadow: '0 8px 24px rgba(22,163,74,0.3)' }}
              >
                Got it
              </button>
            </div>
          </>
        )}

        {/* ── REQUEST form ── */}
        {view === 'request' && (
          <>
            <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(160deg,#1e3a5f 0%,#0f2040 100%)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">Request an upgrade</h2>
              <p className="text-sm text-slate-300 leading-relaxed">Tell us which plan you need and we'll activate it for you.</p>
            </div>
            <div className="px-8 py-6 space-y-4">
              {error && (
                <div className="p-3 rounded-xl text-sm text-red-700 font-medium" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Plan</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['pro', 'enterprise'] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => setPlan(p)}
                      className="flex flex-col items-start p-3.5 rounded-xl border text-left transition-all"
                      style={{
                        borderColor: plan === p ? '#2563eb' : 'rgba(15,23,42,0.12)',
                        background: plan === p ? 'rgba(37,99,235,0.06)' : '#fafafa',
                      }}
                    >
                      <span className="text-sm font-bold text-slate-900 capitalize">{p}</span>
                      <span className="text-xs text-slate-500 mt-0.5">{p === 'pro' ? 'Up to 20 seats' : 'Up to 25 members'}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2 uppercase tracking-wide">Notes <span className="font-normal text-slate-400 normal-case">(optional)</span></label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Tell us about your use case, team size, or timeline…"
                  rows={3}
                  maxLength={300}
                  className="w-full px-4 py-3 rounded-xl text-sm border text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  style={{ borderColor: 'rgba(15,23,42,0.12)', background: '#fafafa' }}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setView('main')}
                  className="flex-1 py-3 rounded-xl text-sm font-semibold border text-slate-700 hover:bg-slate-50 transition-colors"
                  style={{ borderColor: 'rgba(15,23,42,0.12)' }}
                >
                  Back
                </button>
                <button
                  onClick={handleRequestUpgrade}
                  disabled={submitting}
                  className="flex-1 py-3 rounded-xl text-white text-sm font-bold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5 disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 6px 18px rgba(37,99,235,0.3)' }}
                >
                  {submitting ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4" /> Submit Request</>}
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── MAIN view ── */}
        {view === 'main' && (
          <>
            <div className="px-8 pt-8 pb-6" style={{ background: 'linear-gradient(160deg,#1e3a5f 0%,#0f2040 100%)' }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>
                <Lock className="w-6 h-6 text-white" />
              </div>
              <h2 className="text-xl font-black text-white mb-2">{headline}</h2>
              <p className="text-sm text-slate-300 leading-relaxed">{sub}</p>
            </div>
            <div className="px-8 py-6">
              <div className="space-y-3 mb-6">
                {perks.map(({ icon: Icon, label }) => (
                  <div key={label} className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(37,99,235,0.08)' }}>
                      <Icon className="w-4 h-4" style={{ color: '#2563eb' }} />
                    </div>
                    <span className="text-sm font-medium text-slate-700">{label}</span>
                  </div>
                ))}
              </div>

              <button
                onClick={onUpgrade}
                className="w-full py-3.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 8px 24px rgba(37,99,235,0.35)' }}
              >
                <Sparkles className="w-4 h-4" />
                Upgrade to Pro
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => setView('request')}
                className="w-full mt-3 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors flex items-center justify-center gap-1.5"
              >
                Or request access from our team
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              {onClose && (
                <button onClick={onClose} className="w-full mt-1 py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
                  Maybe later
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
