import { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, Zap, Users, BarChart2, Shield, Bot, Lock, X, Loader2, CreditCard, Mail, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PricingProps {
  onNavigate: (page: string) => void;
}

export default function Pricing({ onNavigate }: PricingProps) {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<'pro' | 'team' | 'enterprise' | null>(null);
  const [error, setError] = useState('');
  const [currentTier, setCurrentTier] = useState<'free' | 'pro' | 'team' | 'enterprise'>('free');
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    if (!user) { setCurrentTier('free'); return; }
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const tier = (data?.subscription_tier as 'free' | 'pro' | 'team' | 'enterprise') || 'free';
        setCurrentTier(tier);
      });
  }, [user]);

  async function handleBillingPortal() {
    if (!user) return;
    setLoadingPortal(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ return_url: `${window.location.origin}/#pricing` }),
      });
      const json = await res.json();
      if (json.url) window.location.href = json.url;
      else setError(json.error || 'Could not open billing portal.');
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoadingPortal(false);
    }
  }

  async function handleCheckout(plan: 'pro' | 'team') {
    if (!user) {
      onNavigate('auth');
      return;
    }
    if (currentTier !== 'free') return;
    setLoadingPlan(plan);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const origin = window.location.origin;

      const res = await fetch(`${supabaseUrl}/functions/v1/create-checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          plan,
          seats: plan === 'team' ? 10 : 3,
          success_url: `${origin}/?payment_success=1&plan=${plan}`,
          cancel_url: `${origin}/#pricing`,
        }),
      });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else if (json.url) {
        window.location.href = json.url;
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  }

  function handleEnterprise() {
    onNavigate('contact-us');
  }

  const freeBenefits = [
    '1 free private workspace per month',
    'Up to 3 workspace members',
    'AI War Room (limited queries)',
    'AI agent analysis on workspace content',
    'Workspace memory & pattern tracking',
    'PDF export (3 per month)',
  ];

  const proBenefits = [
    'Everything in Free',
    'Unlimited private workspaces',
    'Unlimited AI War Room queries',
    'Advanced workspace synthesis',
    'Full PDF export history',
    'Priority AI analysis',
    'Early access to new features',
  ];

  const teamBenefits = [
    'Everything in Pro Individual',
    'Up to 10 workspace members',
    'Ideal for startups & product teams',
    'Team-wide AI synthesis',
    'Collaborative War Room sessions',
    'Priority support',
  ];

  const enterpriseBenefits = [
    'Everything in Poddle Team',
    'Unlimited workspace members',
    'Custom AI agent personas',
    'Dedicated account manager',
    'SLA guarantee',
    'Custom onboarding',
  ];

  return (
    <div className="min-h-screen" style={{ background: '#f8fafc' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold mb-4"
            style={{ background: 'rgba(37,99,235,0.08)', color: '#1d4ed8', border: '1px solid rgba(37,99,235,0.15)' }}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 mb-4">
            Choose your plan
          </h1>
          <p className="text-lg text-slate-500 max-w-xl mx-auto leading-relaxed">
            Private encrypted workspaces and AI decision intelligence for professionals and teams.
          </p>
        </div>

        {error && (
          <div
            className="rounded-2xl p-4 mb-6 flex items-center gap-3"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}
          >
            <X className="w-4 h-4 text-red-600 flex-shrink-0" />
            <p className="text-sm text-red-700 font-medium">{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-5 mb-16">

          {/* Free */}
          <div
            className="rounded-2xl p-6 flex flex-col relative"
            style={{ background: '#fff', border: currentTier === 'free' ? '2px solid rgba(15,23,42,0.15)' : '1px solid rgba(15,23,42,0.08)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
          >
            {currentTier === 'free' && user && (
              <div className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full" style={{ background: 'rgba(15,23,42,0.07)', color: '#475569' }}>
                Current plan
              </div>
            )}
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Free</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-slate-900">$0</span>
                <span className="text-slate-400 text-sm mb-1.5">/ month</span>
              </div>
              <p className="text-sm text-slate-500">For individuals getting started</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {freeBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => !user && onNavigate('auth')}
              disabled={!!user}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 border border-slate-200 text-slate-700 disabled:opacity-60 disabled:cursor-default hover:border-slate-300 hover:bg-slate-50 disabled:hover:border-slate-200 disabled:hover:bg-transparent"
            >
              {user ? 'Free plan' : 'Get started free'}
            </button>
          </div>

          {/* Pro Individual */}
          <div
            className="rounded-2xl p-6 flex flex-col relative overflow-hidden"
            style={{ background: 'linear-gradient(160deg, #1e3a5f 0%, #0f2040 100%)', boxShadow: '0 8px 32px rgba(37,99,235,0.25)' }}
          >
            <div
              className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', backdropFilter: 'blur(4px)' }}
            >
              {currentTier === 'pro' ? 'Current plan' : 'Most popular'}
            </div>
            <div className="mb-5">
              <p className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2">Pro Individual</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-white">$19</span>
                <span className="text-blue-300 text-sm mb-1.5">/ month</span>
              </div>
              <p className="text-sm text-slate-400">For founders &amp; professionals</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {proBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-200">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#34d399' }} />
                  {item}
                </li>
              ))}
            </ul>
            {currentTier === 'pro' ? (
              <button
                onClick={handleBillingPortal}
                disabled={loadingPortal}
                className="w-full py-3 rounded-xl text-slate-900 font-bold text-sm bg-white hover:bg-slate-50 transition-all disabled:opacity-70 flex items-center justify-center gap-2"
                style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}
              >
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <ExternalLink className="w-4 h-4 text-blue-600" />}
                Manage subscription
              </button>
            ) : (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={loadingPlan === 'pro' || currentTier !== 'free'}
                className="w-full py-3 rounded-xl text-slate-900 font-bold text-sm bg-white hover:bg-slate-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                style={{ boxShadow: '0 4px 14px rgba(0,0,0,0.2)' }}
              >
                {loadingPlan === 'pro' ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 text-blue-600" />
                    {user ? 'Subscribe' : 'Get started'}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Poddle Team */}
          <div
            className="rounded-2xl p-6 flex flex-col relative overflow-hidden"
            style={{ background: '#fff', border: currentTier === 'team' ? '2px solid #2563eb' : '2px solid rgba(37,99,235,0.2)', boxShadow: '0 4px 16px rgba(37,99,235,0.1)' }}
          >
            <div
              className="absolute top-4 right-4 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(37,99,235,0.1)', color: '#1d4ed8' }}
            >
              {currentTier === 'team' ? 'Current plan' : 'For teams'}
            </div>
            <div className="mb-5">
              <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: '#2563eb' }}>Poddle Team</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-4xl font-black text-slate-900">$79</span>
                <span className="text-slate-400 text-sm mb-1.5">/ month</span>
              </div>
              <p className="text-sm text-slate-500">For startups, agencies &amp; product teams</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {teamBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                  {item}
                </li>
              ))}
            </ul>
            {currentTier === 'team' ? (
              <button
                onClick={handleBillingPortal}
                disabled={loadingPortal}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-70 flex items-center justify-center gap-2 text-white hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
              >
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage subscription
              </button>
            ) : (
              <button
                onClick={() => handleCheckout('team')}
                disabled={loadingPlan === 'team' || currentTier !== 'free'}
                className="w-full py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-white hover:-translate-y-0.5"
                style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
              >
                {loadingPlan === 'team' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Users className="w-4 h-4" />
                    {user ? 'Subscribe' : 'Get started'}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Enterprise */}
          <div
            className="rounded-2xl p-6 flex flex-col"
            style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.08)', boxShadow: '0 2px 8px rgba(15,23,42,0.04)' }}
          >
            <div className="mb-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Enterprise</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-2xl font-black text-slate-900 leading-tight pt-1">Contact sales</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">For large teams &amp; organizations</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {enterpriseBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700">
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#16a34a' }} />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={handleEnterprise}
              className="w-full py-3 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 text-white hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#1e3a5f,#2563eb)', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}
            >
              <Mail className="w-4 h-4" />
              Contact sales
            </button>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mb-16">
          <h2 className="text-2xl font-black text-slate-900 mb-8 text-center">Everything you get from day one</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Lock, title: 'Private Workspaces', desc: 'Encrypted, invite-only spaces for founders and teams to structure decisions with AI — never publicly discoverable.', badge: null },
              { icon: Bot, title: 'AI War Room', desc: 'Bring a decision to the War Room and 7 specialized AI agents debate it — surfacing risks, blind spots, and alternative paths.', badge: null },
              { icon: BarChart2, title: 'Workspace Synthesis', desc: 'AI periodically synthesizes everything in your workspace — surfacing patterns, contradictions, and strategic signals you might miss.', badge: null },
              { icon: Users, title: 'Team Collaboration', desc: 'Free supports up to 3 members. Poddle Team supports 10. AI agents challenge all your assumptions collectively.', badge: 'Team+' },
              { icon: Shield, title: 'Workspace Memory', desc: 'Every insight, decision, and War Room session builds a persistent memory layer that makes future AI analysis sharper over time.', badge: null },
              { icon: Zap, title: 'PDF Export', desc: 'Export your workspace decisions, War Room sessions, and AI synthesis into clean, shareable PDFs for stakeholders.', badge: null },
            ].map(({ icon: Icon, title, desc, badge }) => (
              <div
                key={title}
                className="p-5 rounded-2xl relative"
                style={{ background: '#fff', border: `1px solid ${badge ? 'rgba(37,99,235,0.15)' : 'rgba(15,23,42,0.06)'}` }}
              >
                {badge && (
                  <span
                    className="absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{ background: 'rgba(37,99,235,0.08)', color: '#1d4ed8' }}
                  >
                    {badge}
                  </span>
                )}
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
                  style={{ background: 'rgba(37,99,235,0.08)' }}
                >
                  <Icon style={{ width: '1.125rem', height: '1.125rem', color: '#2563eb' }} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 mb-1.5">{title}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {[
            { q: 'Can I cancel anytime?', a: 'Absolutely. All plans are monthly subscriptions with no lock-in. Cancel anytime from your workspace billing settings and you keep access until the end of the billing period.' },
            { q: 'What is Poddle Team for?', a: "Fast-moving startups, small agencies, and product teams who need to collaborate with AI agents on proprietary ideas. Up to 10 members, full War Room access, and team-wide AI synthesis." },
            { q: 'What happens to my data if I cancel?', a: 'Your workspace data is retained for 30 days after cancellation. You can export your decisions and War Room intelligence before downgrading. Nothing is deleted without notice.' },
          ].map(({ q, a }) => (
            <div key={q} className="p-5 rounded-2xl" style={{ background: '#fff', border: '1px solid rgba(15,23,42,0.06)' }}>
              <h3 className="text-sm font-bold text-slate-900 mb-2">{q}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div
          className="rounded-3xl overflow-hidden text-center"
          style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #0f2040 100%)' }}
        >
          <div className="px-8 py-12">
            <div
              className="w-12 h-12 mx-auto mb-4 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <Lock className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-black text-white mb-3">Ready to sharpen your decisions?</h2>
            <p className="text-slate-300 text-sm mb-7 max-w-md mx-auto">
              Get private encrypted workspaces, AI War Room intelligence, and a team that thinks faster — starting today.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              {currentTier !== 'free' ? (
                <button
                  onClick={handleBillingPortal}
                  disabled={loadingPortal}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-slate-900 bg-white text-sm hover:-translate-y-0.5 transition-transform disabled:opacity-70"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
                >
                  {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <ExternalLink className="w-4 h-4 text-blue-600" />}
                  Manage subscription
                </button>
              ) : (
                <button
                  onClick={() => handleCheckout('pro')}
                  disabled={loadingPlan === 'pro'}
                  className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-slate-900 bg-white text-sm hover:-translate-y-0.5 transition-transform disabled:opacity-70"
                  style={{ boxShadow: '0 8px 24px rgba(0,0,0,0.25)' }}
                >
                  {loadingPlan === 'pro' ? <Loader2 className="w-4 h-4 animate-spin text-blue-600" /> : <CreditCard className="w-4 h-4 text-blue-600" />}
                  Get Pro — $19/mo
                </button>
              )}
              <button
                onClick={handleEnterprise}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl font-bold text-white text-sm hover:-translate-y-0.5 transition-transform"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              >
                <Mail className="w-4 h-4" />
                Contact sales
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
