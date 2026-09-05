export interface StripeProduct {
  id: string;
  monthlyPriceId: string;
  annualPriceId: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  mode: 'subscription' | 'payment';
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_UYgnADbpMs1fyz',
    monthlyPriceId: 'price_1U0R9RFKEEYiEgTrWR6cUt3g',
    annualPriceId: 'price_1UCHrlFKEEYiEgTrzQaengEV',
    name: 'Team',
    description: 'For small teams only. 1–10 seats, Multiplayer War Rooms, shared decision history',
    monthlyPrice: 249.00,
    annualPrice: 2499.00,
    currency: '$',
    mode: 'subscription',
  },
  {
    id: 'prod_UYhkfi8tsa4NJu',
    monthlyPriceId: 'price_1U0RAeFKEEYiEgTrMMbnoLA8',
    annualPriceId: 'price_1UCHpKFKEEYiEgTr0tR2rp29',
    name: 'Business',
    description: '11–100 seats, workspace governance, analytics & decision ownership',
    monthlyPrice: 999.00,
    annualPrice: 9999.00,
    currency: '$',
    mode: 'subscription',
  },
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return STRIPE_PRODUCTS.find(p => p.monthlyPriceId === priceId || p.annualPriceId === priceId);
}
