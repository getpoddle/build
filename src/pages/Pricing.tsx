import { useState, useEffect } from 'react';
import { CheckCircle, Zap, Users, BarChart2, Shield, Bot, Lock, X, Loader2, CreditCard, Mail, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { openExternalCheckout } from '../lib/externalCheckout';
import { useAuth } from '../contexts/AuthContext';
import { parseOwnProfileSensitive } from '../lib/profileSensitive';

interface PricingProps {
  onNavigate: (page: string) => void;
}

type Tier = 'free' | 'team' | 'business' | 'enterprise';
type BillingInterval = 'monthly' | 'annual';

export default function Pricing({ onNavigate }: PricingProps) {
  const { user } = useAuth();
  const [loadingPlan, setLoadingPlan] = useState<Tier | null>(null);
  const [error, setError] = useState('');
  const [externalPaymentUrl, setExternalPaymentUrl] = useState('');
  const [copiedPaymentLink, setCopiedPaymentLink] = useState(false);
  const [currentTier, setCurrentTier] = useState<Tier>('free');
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly');

  useEffect(() => {
    if (!user) { setCurrentTier('free'); return; }
    supabase
      .rpc('get_own_profile_sensitive')
      .maybeSingle()
      .then(({ data }) => {
        const tier = (parseOwnProfileSensitive(data)?.subscription_tier as Tier) || 'free';
        setCurrentTier(tier);
      });
  }, [user]);

  async function handleBillingPortal() {
    if (!user) return;
    setLoadingPortal(true);
    setError('');
    setExternalPaymentUrl('');
    setCopiedPaymentLink(false);
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
        const opened = await openExternalCheckout(json.url);
        if (!opened) setExternalPaymentUrl(json.url);
      } else {
        setError('Could not find your billing account. Try managing your subscription from Workspace Settings instead.');
      }
    } catch (e: unknown) {
      console.error('Poddle checkout navigation failed:', e);
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    } finally {
      setLoadingPortal(false);
    }
  }

  async function handleCheckout(plan: 'team' | 'business') {
    if (!user) {
      onNavigate('auth');
      return;
    }
    setLoadingPlan(plan);
    setError('');
    setExternalPaymentUrl('');
    setCopiedPaymentLink(false);
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
          interval: billingInterval,
          success_url: `${origin}/?payment_success=1&plan=${plan}`,
          cancel_url: `${origin}/#pricing`,
        }),
      });

      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else if (json.url) {
        const opened = await openExternalCheckout(json.url);
        if (!opened) setExternalPaymentUrl(json.url);
      }
    } catch (e: unknown) {
      console.error('Poddle checkout navigation failed:', e);
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
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
    'Pattern Intelligence',
    'Organization Decision Control',
    'Cross-workspace Decision Map',
  ];

  const teamBenefits = [
    'Everything in Free',
    '1–10 seats',
    'Multiplayer War Rooms',
    'Shared decision history',
    'Team-wide AI synthesis',
    'Priority support',
  ];

  const businessBenefits = [
    'Everything in Team Workspace',
    '11–100 seats',
    'Workspace governance & analytics',
    'Decision ownership',
    'Dedicated support channel',
  ];

  const enterpriseBenefits = [
    'Everything in Business',
    '100+ seats',
    'Dedicated SLAs',
    'Custom onboarding & training',
  ];

  const MONTHLY_PRICES: Record<string, number> = { team: 249, business: 999 };
  const ANNUAL_PRICES: Record<string, number> = { team: 2499, business: 9999 };

  function savingsPct(planKey: string): number {
    const monthlyTotal = MONTHLY_PRICES[planKey] * 12;
    const annual = ANNUAL_PRICES[planKey];
    return Math.round(((monthlyTotal - annual) / monthlyTotal) * 100);
  }

  function priceDisplay(planKey: string) {
    if (billingInterval === 'annual') {
      return { price: `$${ANNUAL_PRICES[planKey].toLocaleString()}`, period: '/ year' };
    }
    return { price: `$${MONTHLY_PRICES[planKey]}`, period: '/ month' };
  }

  const teamPrice = priceDisplay('team');
  const businessPrice = priceDisplay('business');

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
    checkoutPlan?: 'team' | 'business';
    savingsBadge?: string;
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
      id: 'team',
      name: 'Team Workspace',
      price: teamPrice.price,
      period: teamPrice.period,
      audience: 'For small teams only',
      benefits: teamBenefits,
      featured: true,
      badge: 'Most popular',
      cta: 'checkout',
      checkoutPlan: 'team',
      savingsBadge: billingInterval === 'annual' ? `Save ${savingsPct('team')}%` : undefined,
    },
    {
      id: 'business',
      name: 'Business',
      price: businessPrice.price,
      period: businessPrice.period,
      audience: 'For mid-market departments',
      benefits: businessBenefits,
      badge: 'For departments',
      badgeClass: 'badge-amber',
      cta: 'checkout',
      checkoutPlan: 'business',
      savingsBadge: billingInterval === 'annual' ? `Save ${savingsPct('business')}%` : undefined,
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      price: 'Starting at $2,500',
      period: '/ month',
      audience: 'For large organizations (100+ seats)',
      benefits: enterpriseBenefits,
      cta: 'enterprise',
    },
  ];

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">

        <div className="text-center mb-10">
          <div
            className="inline-flex items-center gap-2 px-3 py-1.5 mb-4"
            style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}
          >
            <span className="mono-xs font-semibold uppercase tracking-widest text-signal">Simple, transparent pricing</span>
          </div>
          <h1 className="display-heading text-4xl sm:text-5xl mb-4">Choose your plan</h1>
          <p className="text-lg max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
            Private, invite-only workspaces and AI decision intelligence
          </p>
        </div>

        {/* Monthly / Annual toggle */}
        <div className="flex justify-center mb-10">
          <div className="inline-flex p-1" style={{ background: 'var(--app-border-subtle, #f1f5f9)', border: '1px solid var(--app-border)' }}>
            <button
              onClick={() => setBillingInterval('monthly')}
              className="text-sm font-semibold px-4 py-2 transition-colors"
              style={billingInterval === 'monthly'
                ? { background: 'var(--signal, #2563eb)', color: '#fff' }
                : { color: 'var(--app-text-secondary)' }}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className="flex items-center gap-2 text-sm font-semibold px-4 py-2 transition-colors"
              style={billingInterval === 'annual'
                ? { background: 'var(--signal, #2563eb)', color: '#fff' }
                : { color: 'var(--app-text-secondary)' }}
            >
              Annual
              <span
                className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                style={{
                  background: billingInterval === 'annual' ? 'rgba(255,255,255,0.2)' : 'var(--signal-bg)',
                  color: billingInterval === 'annual' ? '#fff' : 'var(--signal)',
                }}
              >
                Save up to {Math.max(savingsPct('team'), savingsPct('business'))}%
              </span>
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 flex items-center gap-3" style={{ background: 'var(--negative-bg)', border: '1px solid var(--negative)' }}>
            <X className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--negative)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--negative)' }}>{error}</p>
          </div>
        )}

        {externalPaymentUrl && (
          <div className="mb-6 rounded-lg border p-4" role="status" style={{ borderColor: 'var(--border, #cbd5e1)' }}>
            <p className="font-semibold mb-2">Your secure Stripe checkout is ready</p>
            <p className="text-sm mb-3">Microsoft Teams could not open the payment page automatically. Open it in your browser, or copy the link and paste it into Chrome.</p>
            <div className="flex flex-wrap gap-3">
              <a href={externalPaymentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-white bg-blue-700">
                <ExternalLink className="w-4 h-4" /> Open secure checkout in browser
              </a>
              <button type="button" className="rounded-md border px-4 py-2" onClick={async () => {
                try { await navigator.clipboard.writeText(externalPaymentUrl); setCopiedPaymentLink(true); }
                catch { setError('Unable to copy automatically. Try opening the checkout link instead.'); }
              }}>{copiedPaymentLink ? 'Link copied' : 'Copy checkout link'}</button>
            </div>
            <p className="text-xs mt-3">Checkout links can expire. If yours expires, select the plan again to generate a fresh link.</p>
          </div>
        )}

        {/* Tier cards */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {tiers.map(tier => {
            const isCurrent = currentTier === tier.id;
            const isFeatured = tier.featured;

            return (
              <div
                key={tier.id}
                className="relative overflow-hidden p-6 flex flex-col"
                style={isFeatured
                  ? { background: 'var(--app-surface)', border: '2px solid var(--signal)', boxShadow: 'var(--shadow-signal)' }
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
                      <div className={`badge ${tier.badgeClass ?? ''}`} style={isFeatured ? { background: 'var(--signal)', color: '#ffffff' } : undefined}>
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
                  <div className="flex items-end gap-1 mb-1 flex-wrap">
                    <span className="stat-card-value" style={isFeatured ? { color: 'var(--app-text-primary)' } : undefined}>{tier.price}</span>
                    <span className="text-sm mb-1.5" style={isFeatured ? { color: 'var(--app-text-secondary)' } : { color: 'var(--app-text-muted)' }}>{tier.period}</span>
                    {tier.savingsBadge && (
                      <span
                        className="text-[10px] font-bold px-1.5 py-0.5 rounded mb-1.5"
                        style={{ background: 'var(--signal-bg)', color: 'var(--signal)' }}
                      >
                        {tier.savingsBadge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm" style={isFeatured ? { color: 'var(--app-text-secondary)' } : { color: 'var(--app-text-secondary)' }}>{tier.audience}</p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-6">
                  {tier.benefits.map(item => (
                    <li key={item} className="flex items-start gap-2.5 text-sm" style={isFeatured ? { color: 'var(--app-text-primary)' } : { color: 'var(--app-text-primary)' }}>
                      <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--signal)' }} />
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
                    onClick={() => handleCheckout(tier.checkoutPlan!)}
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
              { icon: Lock, title: 'Private Workspaces', desc: 'Invite-only spaces for founders and teams to structure decisions with AI. Never listed or searchable.', badge: null },
              { icon: Bot, title: 'AI War Room', desc: 'Bring a decision to the War Room and 7 specialized AI agents debate it — surfacing risks, blind spots, and alternative paths.', badge: null },
              { icon: BarChart2, title: 'Workspace Synthesis', desc: 'AI periodically synthesizes everything in your workspace — surfacing patterns, contradictions, and strategic signals you might miss.', badge: null },
              { icon: Users, title: 'Team Collaboration', desc: 'Team supports 10 seats. Business supports 100. AI agents challenge all your assumptions collectively.', badge: 'Team+' },
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
            { q: 'Can I cancel anytime?', a: 'Absolutely. All plans are subscriptions with no lock-in. Cancel anytime from your workspace billing settings and you keep access until the end of the billing period.' },
            { q: 'What is Team Workspace for?', a: "Small teams who need to collaborate with AI agents on proprietary ideas. 1–10 seats, multiplayer War Rooms, and shared decision history." },
            { q: 'What happens to my data if I cancel?', a: 'Your workspace data is retained for 30 days after cancellation. You can export your decisions and War Room intelligence before downgrading. Nothing is deleted without notice.' },
          ].map(({ q, a }) => (
            <div key={q} className="panel p-5">
              <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--app-text-primary)' }}>{q}</h3>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--app-text-muted)' }}>{a}</p>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="panel p-8 sm:p-12 text-center" style={{ background: 'var(--app-surface-raised)' }}>
          <div className="w-12 h-12 mx-auto mb-4 flex items-center justify-center rounded-lg" style={{ background: 'var(--signal-bg)', border: '1px solid var(--signal)' }}>
            <Lock className="w-6 h-6" style={{ color: 'var(--signal)' }} />
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--app-text-primary)' }}>Ready to sharpen your decisions?</h2>
          <p className="text-sm mb-7 max-w-md mx-auto" style={{ color: 'var(--app-text-secondary)' }}>
          Get private, invite-only workspaces, AI War Room intelligence, and a team that thinks faster, starting today.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            {currentTier !== 'free' ? (
              <button onClick={handleBillingPortal} disabled={loadingPortal} className="btn-primary">
                {loadingPortal ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Manage subscription
              </button>
            ) : (
              <button onClick={() => handleCheckout('team')} disabled={loadingPlan === 'team'} className="btn-primary">
                {loadingPlan === 'team' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                Get Team — {teamPrice.price}{teamPrice.period}
              </button>
            )}
            <button onClick={handleEnterprise} className="btn-secondary">
              <Mail className="w-4 h-4" />
              Contact sales
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
