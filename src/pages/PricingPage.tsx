import { useState } from 'react';
import { Check, Sparkles, ArrowLeft, Zap, Users, Building2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { STRIPE_PRODUCTS, StripeProduct } from '../stripe-config';
import { useSubscription } from '../hooks/useSubscription';
import PoddleMark from '../components/PoddleMark';

interface PricingPageProps {
  onNavigate: (page: string) => void;
}

const PLAN_ICONS: Record<string, React.ElementType> = {
  Individual: Zap,
  Team: Users,
  Business: Building2,
};

export default function PricingPage({ onNavigate }: PricingPageProps) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { subscription } = useSubscription();

  async function handleCheckout(product: StripeProduct) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      onNavigate('auth');
      return;
    }

    setLoadingPriceId(product.priceId);
    setError(null);

    try {
      const origin = window.location.origin;
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            price_id: product.priceId,
            success_url: `${origin}/?checkout=success`,
            cancel_url: `${origin}/?checkout=cancel`,
            mode: product.mode,
          }),
        }
      );

      const json = await res.json();
      if (!res.ok || json.error) throw new Error(json.error ?? 'Checkout failed');
      if (json.url) window.location.href = json.url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.');
      setLoadingPriceId(null);
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(135deg,#000 0%,#0a0a0a 55%,#111 100%)' }}>
      {/* Header */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 pb-4 flex items-center justify-between">
        <button
          onClick={() => onNavigate('home')}
          className="flex items-center gap-2 text-sm font-semibold transition-opacity hover:opacity-70"
          style={{ color: 'rgba(148,163,184,0.8)' }}
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div className="flex items-center gap-2">
          <PoddleMark size={28} />
          <span className="text-white font-black text-lg tracking-tight">Poddle AI</span>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {/* Title */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold mb-5"
            style={{ background: 'rgba(184,134,11,0.15)', color: '#d4a535', border: '1px solid rgba(184,134,11,0.22)' }}>
            <Sparkles className="w-3.5 h-3.5" />
            Simple, transparent pricing
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 tracking-tight">
            Choose your plan
          </h1>
          <p className="text-base max-w-xl mx-auto leading-relaxed" style={{ color: 'rgba(203,213,225,0.7)' }}>
            Start with a 7-day free trial. No credit card required to try.
          </p>
          {subscription.isActive && (
            <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-full text-sm font-semibold"
              style={{ background: 'rgba(22,163,74,0.15)', color: '#34d399', border: '1px solid rgba(22,163,74,0.25)' }}>
              <Check className="w-4 h-4" />
              Current plan: {subscription.planName}
            </div>
          )}
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {STRIPE_PRODUCTS.map(product => {
            const Icon = PLAN_ICONS[product.name] ?? Zap;
            const isCurrentPlan = subscription.priceId === product.priceId;
            const isLoading = loadingPriceId === product.priceId;

            return (
              <div
                key={product.priceId}
                className="relative rounded-3xl p-8 flex flex-col transition-all duration-200 hover:-translate-y-1"
                style={{
                  background: product.highlighted
                    ? 'linear-gradient(135deg,rgba(184,134,11,0.12),rgba(212,165,53,0.06))'
                    : 'rgba(255,255,255,0.04)',
                  border: product.highlighted
                    ? '1px solid rgba(184,134,11,0.35)'
                    : '1px solid rgba(255,255,255,0.09)',
                  boxShadow: product.highlighted ? '0 0 40px rgba(184,134,11,0.15)' : 'none',
                }}
              >
                {product.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-black"
                    style={{ background: 'linear-gradient(135deg,#b8860b,#d4a535)', color: '#000' }}>
                    Most popular
                  </div>
                )}

                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: product.highlighted ? 'rgba(184,134,11,0.2)' : 'rgba(255,255,255,0.08)' }}>
                    <Icon className="w-5 h-5" style={{ color: product.highlighted ? '#d4a535' : '#94a3b8' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{product.name}</h3>
                    {product.seats && (
                      <p className="text-xs font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>
                        {product.seats}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mb-5">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-black text-white">
                      {product.currencySymbol}{product.price.toLocaleString()}
                    </span>
                    <span className="text-sm font-medium" style={{ color: 'rgba(148,163,184,0.6)' }}>/mo</span>
                  </div>
                  <p className="text-sm mt-1.5 leading-relaxed" style={{ color: 'rgba(148,163,184,0.7)' }}>
                    {product.description}
                  </p>
                </div>

                <ul className="space-y-2.5 flex-1 mb-8">
                  {product.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: 'rgba(203,213,225,0.85)' }}>
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: product.highlighted ? '#d4a535' : '#34d399' }} />
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(product)}
                  disabled={isLoading || isCurrentPlan}
                  className="w-full py-3.5 rounded-2xl font-bold text-sm transition-all duration-200 hover:-translate-y-0.5 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none flex items-center justify-center gap-2"
                  style={
                    isCurrentPlan
                      ? { background: 'rgba(22,163,74,0.15)', color: '#34d399', border: '1px solid rgba(22,163,74,0.25)' }
                      : product.highlighted
                        ? { background: 'linear-gradient(135deg,#b8860b,#d4a535)', color: '#000', boxShadow: '0 4px 14px rgba(184,134,11,0.4)' }
                        : { background: 'rgba(255,255,255,0.08)', color: '#fff', border: '1px solid rgba(255,255,255,0.15)' }
                  }
                >
                  {isLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                  ) : isCurrentPlan ? (
                    <><Check className="w-4 h-4" />Current plan</>
                  ) : (
                    'Get started'
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {error && (
          <div className="max-w-md mx-auto mb-8 px-4 py-3 rounded-xl text-sm text-red-300 text-center"
            style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <p className="text-center text-xs" style={{ color: 'rgba(100,116,139,0.6)' }}>
          All plans include a 7-day free trial. Cancel anytime. Billed monthly.
        </p>
      </div>
    </div>
  );
}