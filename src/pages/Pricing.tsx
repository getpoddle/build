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
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const res = await fetch(`${supabaseUrl}/functions/v1/create-billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          return_url: `${window.location.origin}/#pricing`,
        }),
      });
      const json = await res.json();
      if (json.url) {
        window.location.href = json.url;
      } else {
        setError('Could not find your billing account. Try managing your subscription from Workspace Settings instead.');
      }
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
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-4"
            style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: 'var(--signal)' }} />
            <span className="mono-xs font-semibold uppercase tracking-widest text-signal">Simple, transparent pricing</span>
          </div>
          <h1 className="display-heading text-4xl sm:text-5xl mb-4">Choose your plan</h1>
          <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
            Private encrypted workspaces and AI decision intelligence for professionals and teams.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 flex items-center gap-3" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
            <X className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--negative)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--negative)' }}>{error}</p>
          </div>
        )}

        <div className="grid md:grid-cols-4 gap-5 mb-16">

          {/* Free */}
          <div
            className="panel p-6 flex flex-col relative"
            style={currentTier === 'free' ? { borderColor: 'var(--app-text-muted)' } : undefined}
          >
            {currentTier === 'free' && user && (
              <div className="absolute top-4 right-4 badge badge-slate">Current plan</div>
            )}
            <div className="mb-5">
              <p className="section-label mb-2">Free</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="stat-card-value">$0</span>
                <span className="text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>/ month</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>For individuals getting started</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {freeBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-positive" />
                  {item}
                </li>
              ))}
            </ul>
            <button
              onClick={() => !user && onNavigate('auth')}
              disabled={!!user}
              className="btn-secondary w-full"
            >
              {user ? 'Free plan' : 'Get started free'}
            </button>
          </div>

          {/* Pro Individual — featured */}
          <div
            className="relative overflow-hidden p-6 flex flex-col"
            style={{ background: '#0e1117', border: '1px solid var(--signal)', boxShadow: 'var(--shadow-signal)' }}
          >
            <div className="absolute top-4 right-4 badge" style={{ background: 'var(--signal)', color: 'var(--ink-900)' }}>
              {currentTier === 'pro' ? 'Current plan' : 'Most popular'}
            </div>
            <div className="mb-5">
              <p className="mono-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--signal)' }}>Pro Individual</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="stat-card-value" style={{ color: '#ffffff' }}>$19</span>
                <span className="text-sm mb-1.5" style={{ color: 'rgba(255,255,255,0.7)' }}>/ month</span>
              </div>
              <p className="text-sm" style={{ color: 'rgba(255,255,255,0.8)' }}>For founders &amp; professionals</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {proBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(255,255,255,0.85)' }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
                  {item}
                </li>
              ))}
            </ul>
            {currentTier === 'pro' ? (
              <button
                onClick={handleBillingPortal}
                disabled={loadingPortal}
                className="btn-primary w-full"
              >
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage subscription
              </button>
            ) : (
              <button
                onClick={() => handleCheckout('pro')}
                disabled={loadingPlan === 'pro' || currentTier !== 'free'}
                className="btn-primary w-full"
              >
                {loadingPlan === 'pro' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <CreditCard className="w-4 h-4" />
                    {user ? 'Subscribe' : 'Get started'}
                  </>
                )}
              </button>
            )}
          </div>

          {/* Poddle Team */}
          <div
            className="panel p-6 flex flex-col relative"
            style={currentTier === 'team' ? { borderColor: 'var(--signal)' } : undefined}
          >
            <div className="absolute top-4 right-4 badge badge-amber">
              {currentTier === 'team' ? 'Current plan' : 'For teams'}
            </div>
            <div className="mb-5">
              <p className="mono-xs font-bold uppercase tracking-widest mb-2 text-signal">Poddle Team</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="stat-card-value">$79</span>
                <span className="text-sm mb-1.5" style={{ color: 'var(--app-text-muted)' }}>/ month</span>
              </div>
              <p className="text-sm" style={{ color: 'var(--app-text-secondary)' }}>For startups, agencies &amp; product teams</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {teamBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-positive" />
                  {item}
                </li>
              ))}
            </ul>
            {currentTier === 'team' ? (
              <button
                onClick={handleBillingPortal}
                disabled={loadingPortal}
                className="btn-primary w-full"
              >
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage subscription
              </button>
            ) : (
              <button
                onClick={() => handleCheckout('team')}
                disabled={loadingPlan === 'team' || currentTier !== 'free'}
                className="btn-primary w-full"
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
          <div className="panel p-6 flex flex-col">
            <div className="mb-5">
              <p className="section-label mb-2">Enterprise</p>
              <div className="flex items-end gap-1 mb-1">
                <span className="text-2xl font-bold leading-tight pt-1" style={{ color: 'var(--app-text-primary)' }}>Contact sales</span>
              </div>
              <p className="text-sm mt-1" style={{ color: 'var(--app-text-secondary)' }}>For large teams &amp; organizations</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {enterpriseBenefits.map(item => (
                <li key={item} className="flex items-start gap-2.5 text-sm" style={{ color: 'var(--app-text-primary)' }}>
                  <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-positive" />
                  {item}
                </li>
              ))}
            </ul>
            <button onClick={handleEnterprise} className="btn-secondary w-full">
              <Mail className="w-4 h-4" />
              Contact sales
            </button>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mb-16">
          <h2 className="display-heading text-2xl mb-8 text-center">Everything you get from day one</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Lock, title: 'Private Workspaces', desc: 'Encrypted, invite-only spaces for founders and teams to structure decisions with AI — never publicly discoverable.', badge: null },
              { icon: Bot, title: 'AI War Room', desc: 'Bring a decision to the War Room and 7 specialized AI agents debate it — surfacing risks, blind spots, and alternative paths.', badge: null },
              { icon: BarChart2, title: 'Workspace Synthesis', desc: 'AI periodically synthesizes everything in your workspace — surfacing patterns, contradictions, and strategic signals you might miss.', badge: null },
              { icon: Users, title: 'Team Collaboration', desc: 'Free supports up to 3 members. Poddle Team supports 10. AI agents challenge all your assumptions collectively.', badge: 'Team+' },
              { icon: Shield, title: 'Workspace Memory', desc: 'Every insight, decision, and War Room session builds a persistent memory layer that makes future AI analysis sharper over time.', badge: null },
              { icon: Zap, title: 'PDF Export', desc: 'Export your workspace decisions, War Room sessions, and AI synthesis into clean, shareable PDFs for stakeholders.', badge: null },
            ].map(({ icon: Icon, title, desc, badge }) => (
              <div key={title} className="panel p-5 relative">
                {badge && (
                  <span className="absolute top-4 right-4 badge badge-amber">{badge}</span>
                )}
                <div className="w-9 h-9 flex items-center justify-center mb-3" style={{ background: 'var(--signal-bg)' }}>
                  <Icon className="w-4 h-4" style={{ color: 'var(--signal)' }} />
                </div>
                <h3 className="text-sm font-semibold mb-1.5" style={{ color: 'var(--app-text-primary)' }}>{title}</h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{desc}</p>
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
            <div key={q} className="panel p-5">
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>{q}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="panel p-8 sm:p-12 text-center" style={{ background: '#0e1117' }}>
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>
            <Lock className="w-6 h-6" style={{ color: 'var(--signal)' }} />
          </div>
          <h2 className="display-heading text-2xl mb-3" style={{ color: '#ffffff' }}>Ready to sharpen your decisions?</h2>
          <p className="text-sm mb-7 max-w-md mx-auto" style={{ color: 'rgba(255,255,255,0.7)' }}>
            Get private encrypted workspaces, AI War Room intelligence, and a team that thinks faster — starting today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentTier !== 'free' ? (
              <button onClick={handleBillingPortal} disabled={loadingPortal} className="btn-primary">
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage subscription
              </button>
            ) : (
              <button onClick={() => handleCheckout('pro')} disabled={loadingPlan === 'pro'} className="btn-primary">
                {loadingPlan === 'pro' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Get Pro — $19/mo
              </button>
            )}
            <button onClick={handleEnterprise} className="btn-secondary" style={{ background: 'transparent', color: '#ffffff', borderColor: 'rgba(255,255,255,0.4)' }}>
              <Mail className="w-4 h-4" />
              Contact sales
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
