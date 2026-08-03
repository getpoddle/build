import { useState, useEffect } from 'react';
import { CheckCircle, Sparkles, Zap, Users, BarChart2, Shield, Bot, Lock, X, Loader2, CreditCard, Mail, ExternalLink, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PricingProps {
  onNavigate: (page: string) => void;
}

type Tier = 'free' | 'pro' | 'team' | 'business' | 'enterprise';

export default function Pricing({ onNavigate }: PricingProps) {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<Tier | null>(null);
  const [error, setError] = useState('');
  const [currentTier, setCurrentTier] = useState<Tier>('free');
  const [loadingPortal, setLoadingPortal] = useState(false);

  useEffect(() => {
    if (!user) { setCurrentTier('free'); return; }
    supabase
      .rpc('get_own_profile_sensitive')
      .maybeSingle()
      .then(({ data }) => {
        const tier = (data?.subscription_tier as Tier) || 'free';
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

  async function handleCheckout(plan: 'pro' | 'team' | 'business') {
    if (!user) {
      onNavigate('auth');
      return;
    }
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
          seats: plan === 'business' ? 25 : plan === 'team' ? 10 : 1,
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
    '1 War Room session per month',
    'Board Brief PDF export (trial)',
    'AI agent analysis on workspace content',
    'Workspace memory & pattern tracking',
  ];

  const proBenefits = [
    'Everything in Free',
    'Unlimited War Room sessions',
    'Poddle Voice',
    'Board Brief PDF export',
    'Document upload',
    'Priority AI analysis',
    'Early access to new features',
  ];

  const teamBenefits = [
    'Everything in Pro Individual',
    '1–10 seats included',
    'Multiplayer War Rooms',
    'Shared decision history',
    'Team-wide AI synthesis',
    'Priority support',
  ];

  const businessBenefits = [
    'Everything in Team Workspace',
    '25–100 seats',
    'SSO authentication',
    'Workspace governance & analytics',
    'Dedicated support channel',
  ];

  const enterpriseBenefits = [
    'Everything in Business',
    'Custom agent orchestration',
    'Pattern Intelligence',
    'Full audit trails',
    'Dedicated SLAs',
    'Custom onboarding & training',
  ];

  const tiers: {
    id: Tier;
    name: string;
    price: string;
    period: string;
    audience: string;
    benefits: string[];
    featured?: boolean;
    badge?: string;
    badgeClass?: string;
    cta: 'checkout' | 'enterprise' | 'none';
    checkoutPlan?: 'pro' | 'team' | 'business';
  }[] = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: '/ month',
      audience: 'For individuals getting started',
      benefits: freeBenefits,
      cta: 'none',
    },
    {
      id: 'pro',
      name: 'Pro Individual',
      price: '$39',
      period: '/ month',
      audience: 'For individual founders & strategists',
      benefits: proBenefits,
      featured: true,
      badge: 'Most popular',
      cta: 'checkout',
      checkoutPlan: 'pro',
    },
    {
      id: 'team',
      name: 'Team Workspace',
      price: '$249',
      period: '/ month',
      audience: 'For pods and small teams',
      benefits: teamBenefits,
      badge: 'For teams',
      badgeClass: 'badge-amber',
      cta: 'checkout',
      checkoutPlan: 'team',
    },
    {
      id: 'business',
      name: 'Business',
      price: '$999',
      period: '/ month',
      audience: 'For mid-market departments',
      benefits: businessBenefits,
      badge: 'For departments',
      badgeClass: 'badge-amber',
      cta: 'checkout',
      checkoutPlan: 'business',
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Starting at $2,500',
      period: '/ month',
      audience: 'For large organizations (200+ seats)',
      benefits: enterpriseBenefits,
      cta: 'enterprise',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

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

        {/* Tier cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-5 mb-16">
          {tiers.map(tier => {
            const isCurrent = currentTier === tier.id;
            const isFeatured = tier.featured;

            return (
              <div
                key={tier.id}
                className="relative overflow-hidden p-6 flex flex-col"
                style={isFeatured
                  ? { background: '#0e1117', border: '1px solid var(--signal)', boxShadow: 'var(--shadow-signal)' }
                  : isCurrent
                    ? { borderColor: 'var(--app-text-muted)' }
                    : undefined
                }
              >
                {/* Badge */}
                {tier.badge && (
                  <div className="absolute top-4 right-4">
                    {isCurrent ? (
                      <div className="badge badge-slate">Current plan</div>
                    ) : (
                      <div className={`badge ${tier.badgeClass ?? ''}`} style={isFeatured ? { background: 'var(--signal)', color: 'var(--ink-900)' } : undefined}>
                        {tier.badge}
                      </div>
                    )}
                  </div>
                )}
                {isCurrent && !tier.badge && (
                  <div className="absolute top-4 right-4 badge badge-slate">Current plan</div>
                )}

                <div className="mb-5">
                  <p className={`mono-xs font-bold uppercase tracking-widest mb-2 ${isFeatured ? '' : 'text-signal'}`} style={isFeatured ? { color: 'var(--signal)' } : undefined}>
                    {tier.name}
                  </p>
                  <div className="flex items-end gap-1 mb-1">
                    <span className="stat-card-value" style={isFeatured ? { color: '#ffffff' } : undefined}>{tier.price}</span>
                    <span className="text-sm mb-1.5" style={isFeatured ? { color: 'rgba(255,255,255,0.7)' } : { color: 'var(--app-text-muted)' }}>{tier.period}</span>
                  </div>
                  <p className="text-sm" style={isFeatured ? { color: 'rgba(255,255,255,0.8)' } : { color: 'var(--app-text-secondary)' }}>{tier.audience}</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {tier.benefits.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={isFeatured ? { color: 'rgba(255,255,255,0.85)' } : { color: 'var(--app-text-primary)' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={isFeatured ? { color: 'var(--signal)' } : undefined} />
                      {item}
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <button
                    onClick={handleBillingPortal}
                    disabled={loadingPortal}
                    className="btn-primary w-full"
                  >
                    {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                    Manage subscription
                  </button>
                ) : tier.cta === 'checkout' && tier.checkoutPlan ? (
                  <button
                    onClick={() => handleCheckout(tier.checkoutPlan)}
                    disabled={loadingPlan === tier.id || isCurrent}
                    className="btn-primary w-full"
                  >
                    {loadingPlan === tier.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        {user ? 'Subscribe' : 'Get started'}
                      </>
                    )}
                  </button>
                ) : tier.cta === 'enterprise' ? (
                  <button onClick={handleEnterprise} className="btn-secondary w-full">
                    <Mail className="w-4 h-4" />
                    Contact sales
                  </button>
                ) : (
                  <button
                    onClick={() => !user && onNavigate('auth')}
                    disabled={!!user}
                    className="btn-secondary w-full"
                  >
                    {user ? 'Free plan' : 'Get started free'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Feature highlights */}
        <div className="mb-16">
          <h2 className="display-heading text-2xl mb-8 text-center">Everything you get from day one</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: Lock, title: 'Private Workspaces', desc: 'Encrypted, invite-only spaces for founders and teams to structure decisions with AI — never publicly discoverable.', badge: null },
              { icon: Bot, title: 'AI War Room', desc: 'Bring a decision to the War Room and 7 specialized AI agents debate it — surfacing risks, blind spots, and alternative paths.', badge: null },
              { icon: BarChart2, title: 'Workspace Synthesis', desc: 'AI periodically synthesizes everything in your workspace — surfacing patterns, contradictions, and strategic signals you might miss.', badge: null },
              { icon: Users, title: 'Team Collaboration', desc: 'Free supports 1 member. Team supports 10. Business supports 100. AI agents challenge all your assumptions collectively.', badge: 'Team+' },
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
            { q: 'What is Team Workspace for?', a: "Fast-moving pods and small teams who need to collaborate with AI agents on proprietary ideas. 1–10 seats, multiplayer War Rooms, and shared decision history." },
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
                Get Pro — $39/mo
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
