// Integration Types for MagnetLab

// ============================================
// UNIPILE TYPES
// ============================================

export interface UnipilePost {
  id: string;
  social_id: string;
  account_id: string;
  provider: 'LINKEDIN';
  text: string;
  created_at: string;
}

export interface UnipilePostStats {
  id: string;
  social_id: string;
  likes_count: number;
  comments_count: number;
  shares_count: number;
  views_count: number;
}

// ============================================
// STRIPE TYPES
// ============================================

export type SubscriptionPlan = 'free' | 'unlimited';
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'trialing';

export interface Subscription {
  id: string;
  userId: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingPlan {
  id: SubscriptionPlan;
  name: string;
  price: number;
  priceId: string | null;
  features: string[];
  limits: {
    leadMagnets: number;
    scheduling: boolean;
    automation: boolean;
    analytics: boolean;
  };
}

export const PRICING_PLANS: PricingPlan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    priceId: null,
    features: [
      'Unlimited lead magnets',
      'Premium AI generation',
      'Custom landing pages',
      'Email sequences',
      'LinkedIn integration',
      'LinkedIn scheduling',
      'Advanced analytics',
    ],
    limits: {
      leadMagnets: 999999,
      scheduling: true,
      automation: true,
      analytics: true,
    },
  },
  {
    id: 'unlimited',
    name: 'Unlimited',
    price: 250,
    priceId: process.env.STRIPE_UNLIMITED_PRICE_ID || null,
    features: [
      'Unlimited lead magnets',
      'Premium AI (Opus 4.5)',
      'Custom landing pages',
      'Email sequences',
      'LinkedIn integration',
      'LinkedIn scheduling',
      'Advanced analytics',
      'Priority support',
    ],
    limits: {
      leadMagnets: 999999,
      scheduling: true,
      automation: true,
      analytics: true,
    },
  },
];

// ============================================
// USAGE TRACKING
// ============================================

export interface UsageTracking {
  id: string;
  userId: string;
  monthYear: string;
  leadMagnetsCreated: number;
  postsScheduled: number;
  createdAt: string;
  updatedAt: string;
}
