export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  mode: 'subscription' | 'payment';
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_UXcbO4NuuJRE5A',
    priceId: 'price_1U0R8YFKEEYiEgTrjn5zEL7m',
    name: 'Individual',
    description: 'Unlimited sessions, Voice, Board Brief Export, Document Upload',
    price: 39.00,
    currency: '$',
    mode: 'subscription',
  },
  {
    id: 'prod_UYgnADbpMs1fyz',
    priceId: 'price_1U0R9RFKEEYiEgTrWR6cUt3g',
    name: 'Team',
    description: '1–10 seats, Multiplayer War Rooms, shared decision history',
    price: 249.00,
    currency: '$',
    mode: 'subscription',
  },
  {
    id: 'prod_UYhkfi8tsa4NJu',
    priceId: 'price_1U0RAeFKEEYiEgTrMMbnoLA8',
    name: 'Business',
    description: '25–100 seats, SSO, workspace governance & analytics',
    price: 999.00,
    currency: '$',
    mode: 'subscription',
  },
];

export function getProductByPriceId(priceId: string): StripeProduct | undefined {
  return STRIPE_PRODUCTS.find(p => p.priceId === priceId);
}