// Integration Types for MagnetLab

// ============================================
// LEADSHARK TYPES
// ============================================

export interface LeadSharkAutomation {
  id: string;
  name: string;
  post_id: string;
  linkedin_post_url: string;
  keywords: string[];
  dm_template: string;
  auto_connect: boolean;
  auto_like: boolean;
  comment_reply_template?: string;
  non_first_degree_reply_template?: string;
  enable_follow_up: boolean;
  follow_up_template?: string;
  follow_up_delay_minutes?: number;
  status: 'Draft' | 'Running' | 'Paused';
  leads_captured?: number;
  created_at: string;
  updated_at: string;
}

export interface LeadSharkScheduledPost {
  id: string;
  content: string;
  scheduled_time: string;
  is_public: boolean;
  automation?: Partial<LeadSharkAutomation>;
  status: 'scheduled' | 'published' | 'failed';
  created_at: string;
}

export interface LeadSharkEnrichmentResult {
  linkedin_url: string;
  first_name: string;
  last_name: string;
  headline: string;
  location: string;
  profile_picture_url?: string;
  experience: Array<{
    title: string;
    company: string;
    start_date: string;
    end_date?: string;
    is_current: boolean;
  }>;
  education: Array<{
    school: string;
    degree?: string;
    field_of_study?: string;
  }>;
  skills: string[];
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
      '2 lead magnets per month',
      'Basic AI generation',
      'Hosted content pages',
      'Community support',
    ],
    limits: {
      leadMagnets: 2,
      scheduling: false,
      automation: false,
      analytics: false,
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
      'LeadShark integration',
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
