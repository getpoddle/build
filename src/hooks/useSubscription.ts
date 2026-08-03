import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { getProductByPriceId } from '../stripe-config';

export interface SubscriptionInfo {
  status: string | null;
  priceId: string | null;
  planName: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: number | null;
  loading: boolean;
}

export function useSubscription(userId: string | undefined): SubscriptionInfo {
  const [info, setInfo] = useState<SubscriptionInfo>({
    status: null,
    priceId: null,
    planName: null,
    cancelAtPeriodEnd: false,
    currentPeriodEnd: null,
    loading: true,
  });

  useEffect(() => {
    if (!userId) {
      setInfo(prev => ({ ...prev, loading: false }));
      return;
    }

    supabase
      .from('stripe_user_subscriptions')
      .select('subscription_status, price_id, cancel_at_period_end, current_period_end')
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          const product = data.price_id ? getProductByPriceId(data.price_id) : null;
          setInfo({
            status: data.subscription_status,
            priceId: data.price_id,
            planName: product?.name ?? null,
            cancelAtPeriodEnd: data.cancel_at_period_end ?? false,
            currentPeriodEnd: data.current_period_end ?? null,
            loading: false,
          });
        } else {
          setInfo({ status: null, priceId: null, planName: null, cancelAtPeriodEnd: false, currentPeriodEnd: null, loading: false });
        }
      });
  }, [userId]);

  return info;
}