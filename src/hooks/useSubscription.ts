import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { STRIPE_PRODUCTS } from '../stripe-config';

export interface SubscriptionInfo {
  isActive: boolean;
  planName: string | null;
  priceId: string | null;
  status: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
}

const DEFAULT: SubscriptionInfo = {
  isActive: false,
  planName: null,
  priceId: null,
  status: null,
  cancelAtPeriodEnd: false,
  currentPeriodEnd: null,
};

export function useSubscription() {
  const [subscription, setSubscription] = useState<SubscriptionInfo>(DEFAULT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const { data, error } = await supabase
          .from('stripe_user_subscriptions')
          .select('*')
          .maybeSingle();

        if (!active) return;

        if (error || !data) {
          setSubscription(DEFAULT);
          return;
        }

        const isActive =
          data.subscription_status === 'active' ||
          data.subscription_status === 'trialing';

        const product = STRIPE_PRODUCTS.find(p => p.priceId === data.price_id);

        setSubscription({
          isActive,
          planName: product?.name ?? null,
          priceId: data.price_id ?? null,
          status: data.subscription_status ?? null,
          cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
          currentPeriodEnd: data.current_period_end ?? null,
        });
      } catch {
        if (active) setSubscription(DEFAULT);
      } finally {
        if (active) setLoading(false);
      }
    }

    load();
    return () => { active = false; };
  }, []);

  return { subscription, loading };
}