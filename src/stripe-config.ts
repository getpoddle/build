export interface StripeProduct {
  id: string;
  priceId: string;
  name: string;
  description: string;
  price: number;
  currencySymbol: string;
  mode: 'subscription' | 'payment';
  features: string[];
  highlighted?: boolean;
  seats?: string;
}

export const STRIPE_PRODUCTS: StripeProduct[] = [
  {
    id: 'prod_UXcbO4NuuJRE5A',
    priceId: 'price_1U0R8YFKEEYiEgTrjn5zEL7m',
    name: 'Individual',
    description: 'Unlimited sessions, Voice, Board Brief Export, Document Upload',
    price: 39.00,
    currencySymbol: '$',
    mode: 'subscription',
    seats: '1 seat',
    features: [
      'Unlimited War Room sessions',
      'Voice input (Whisper)',
      'Board Brief PDF export',
      'Document upload (PDF, DOCX)',
      'Pattern Intelligence',
      '7 specialist AI agents',
      'War Room synthesis',
    ],
  },
  {
    id: 'prod_UYgnADbpMs1fyz',
    priceId: 'price_1U0R9RFKEEYiEgTrWR6cUt3g',
    name: 'Team',
    description: '1–10 seats, Multiplayer War Rooms, shared decision history',
    price: 249.00,
    currencySymbol: '$',
    mode: 'subscription',
    highlighted: true,
    seats: 'Up to 10 seats',
    features: [
      'Everything in Individual',
      'Up to 10 team seats',
      'Multiplayer War Rooms',
      'Shared decision history',
      'Team chat with @mentions',
      'Workspace member management',
      'Workspace invites',
    ],
  },
  {
    id: 'prod_UYhkfi8tsa4NJu',
    priceId: 'price_1U0RAeFKEEYiEgTrMMbnoLA8',
    name: 'Business',
    description: '25–100 seats, SSO, workspace governance & analytics',
    price: 999.00,
    currencySymbol: '$',
    mode: 'subscription',
    seats: '25–100 seats',
    features: [
      'Everything in Team',
      '25–100 seats',
      'SSO integration',
      'Workspace governance',
      'Advanced analytics',
      'Dedicated support',
      'Custom onboarding',
    ],
  },
];