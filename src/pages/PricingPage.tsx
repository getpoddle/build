import { useState } from 'react';
import { Check, Zap, Building2, User, ArrowLeft, Loader2 } from 'lucide-react';
import { STRIPE_PRODUCTS, type StripeProduct } from '../stripe-config';
import { createCheckoutSession } from '../lib/checkout';
import { useSubscription } from '../hooks/useSubscription';
import { useAuth } from '../contexts/AuthContext';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  Individual: User,
  Team: Zap,
  Business: Building2,
};

const PLAN_FEATURES: Record<string, string[]> = {
  Individual: [
    'Up to 3 seats',
    'Voice input for all messages',
    'Board Brief PDF export',
    'Document upload (PDF, DOCX)',
    '7 specialist AI agents',
    'Decision Health Score',
    'Pattern Intelligence',
  ],
  Team: [
    'Everything in Individual',
    'Up to 10 seats',
    'Multiplayer War Rooms',
    'Shared decision history',
    'Team Chat with @mentions',
    'Workspace Synthesis',
    'Pattern Intelligence',
    'Action items & outcomes',
  ],
  Business: [
    'Everything in Team',
    'Up to 100 seats',
    'Single Sign-On (SSO)',
    'Workspace governance',
    'Analytics dashboard',
    'Decision ownership',
    'Priority support',
    'Custom integrations',
  ],
};

const PLAN_HIGHLIGHT: Record<string, boolean> = {
  Individual: false,
  Team: true,
  Business: false,
};

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const { user } = useAuth();
  const subscription = useSubscription(user?.id);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleCheckout(product: StripeProduct) {
    if (!user) {
      onNavigate('auth');
      return;
    }
    setError(null);
    setLoadingPriceId(product.priceId);
    try {
      const url = await createCheckoutSession(product.priceId);
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Checkout failed. Please try again.');
      setLoadingPriceId(null);
    }
  }

  const isCurrentPlan = (product: StripeProduct) =>
    subscription.priceId === product.priceId &&
    (subscription.status === 'active' || subscription.status === 'trialing');

  return (
    <div className="min-h-screen" style={{ background: 'var(--app-bg)' }}>
      {/* Header */}
      <div style={{ background: 'var(--app-surface)', borderBottom: '1px solid var(--app-border)' }} className="sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => onNavigate('home')}
            className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
            style={{ color: 'var(--app-text-secondary)' }}
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1" />
          {!user && (
            <button
              onClick={() => onNavigate('auth')}
              className="text-sm font-semibold transition-colors"
              style={{ color: 'var(--signal)' }}
            >
              Sign in
            </button>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-14">
          <div
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-5"
            style={{ background: 'var(--signal-bg)', color: 'var(--signal)', border: '1px solid var(--signal)' }}
          >
            Simple, transparent pricing
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight mb-4" style={{ color: 'var(--app-text-primary)' }}>
            Choose your plan
          </h1>
          <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--app-text-secondary)' }}>
            Unlock the full power of adversarial AI decision intelligence. Every plan includes the War Room, all 7 agents, and unlimited workspace creation.
          </p>

          {subscription.planName && !subscription.loading && (
            <div
              className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(22,163,74,0.1)', color: '#15803d', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <Check className="w-4 h-4" />
              Current plan: {subscription.planName}
            </div>
          )}
        </div>

        {error && (
          <div
            className="max-w-md mx-auto mb-8 px-4 py-3 rounded-xl text-sm font-medium text-center"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#b91c1c' }}
          >
            {error}
          </div>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
          {STRIPE_PRODUCTS.map(product => {
            const Icon = PLAN_ICONS[product.name] ?? User;
            const features = PLAN_FEATURES[product.name] ?? [];
            const highlighted = PLAN_HIGHLIGHT[product.name];
            const isCurrent = isCurrentPlan(product);
            const isLoading = loadingPriceId === product.priceId;
            const anyLoading = loadingPriceId !== null;

            return (
              <div
                key={product.id}
                className="relative flex flex-col rounded-2xl overflow-hidden transition-all duration-200 hover:-translate-y-1"
                style={{
                  background: 'var(--app-surface)',
                  border: highlighted ? '2px solid var(--signal)' : '1px solid var(--app-border)',
                  boxShadow: highlighted ? 'var(--shadow-signal)' : 'var(--shadow-md)',
                }}
              >
                {highlighted && (
                  <div
                    className="absolute top-0 inset-x-0 py-1.5 text-center text-xs font-black uppercase tracking-widest"
                    style={{ background: 'var(--signal)', color: '#ffffff' }}
                  >
                    Most Popular
                  </div>
                )}

                <div className={`p-8 ${highlighted ? 'pt-11' : ''} flex flex-col flex-1`}>
                  {/* Icon + name */}
                  <div className="flex items-center gap-3 mb-6">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'var(--signal-bg)' }}
                    >
                      <Icon className="w-5 h-5" style={{ color: 'var(--signal)' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold" style={{ color: 'var(--app-text-primary)' }}>
                        {product.name}
                      </h3>
                      <p className="text-xs leading-tight" style={{ color: 'var(--app-text-muted)' }}>
                        {product.description}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="mb-8">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-black" style={{ color: 'var(--app-text-primary)' }}>
                        {product.currency}{product.price.toLocaleString()}
                      </span>
                      <span className="text-sm font-medium" style={{ color: 'var(--app-text-muted)' }}>
                        /month
                      </span>
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {features.map(feat => (
                      <li key={feat} className="flex items-start gap-2.5">
                        <div className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: 'rgba(22,163,74,0.1)' }}>
                          <Check className="w-2.5 h-2.5" style={{ color: '#16a34a' }} />
                        </div>
                        <span className="text-sm leading-snug" style={{ color: 'var(--app-text-secondary)' }}>
                          {feat}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <button
                    onClick={() => handleCheckout(product)}
                    disabled={anyLoading || isCurrent}
                    className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl font-bold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:opacity-90"
                    style={
                      isCurrent
                        ? { background: 'rgba(22,163,74,0.12)', color: '#15803d' }
                        : highlighted
                          ? { background: 'var(--signal)', color: '#ffffff' }
                          : { background: 'var(--app-text-primary)', color: '#ffffff' }
                    }
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Redirecting…
                      </>
                    ) : isCurrent ? (
                      <>
                        <Check className="w-4 h-4" />
                        Current plan
                      </>
                    ) : (
                      <>
                        {user ? `Get ${product.name}` : 'Sign up to subscribe'}
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer note */}
        <p className="text-center text-xs mt-10" style={{ color: 'var(--app-text-muted)' }}>
          All plans billed monthly. Cancel anytime. Payments secured by Stripe.
        </p>
      </div>
    </div>
  );
}
