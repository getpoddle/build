import { supabase } from './supabase';

export async function createCheckoutSession(priceId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Not authenticated');

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const res = await fetch(`${supabaseUrl}/functions/v1/stripe-checkout`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      price_id: priceId,
      success_url: `${window.location.origin}/?checkout=success`,
      cancel_url: `${window.location.origin}/?checkout=cancel`,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create checkout session');
  }

  const data = await res.json();
  if (!data.url) throw new Error('No checkout URL returned');
  return data.url;
}