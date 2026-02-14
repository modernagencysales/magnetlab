// Stripe Billing Integration for MagnetLab

import Stripe from 'stripe';
import type { SubscriptionPlan } from '@/lib/types/integrations';

// Initialize Stripe client
function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  return new Stripe(secretKey, {
    apiVersion: '2026-01-28.clover',
  });
}

// Price IDs for each plan
export const STRIPE_PRICE_IDS: Record<Exclude<SubscriptionPlan, 'free'>, string> = {
  unlimited: process.env.STRIPE_UNLIMITED_PRICE_ID || '',
};

// =============================================================================
// CUSTOMER MANAGEMENT
// =============================================================================

export async function createCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
): Promise<Stripe.Customer> {
  const stripe = getStripeClient();

  return stripe.customers.create({
    email,
    name,
    metadata: {
      ...metadata,
      source: 'magnetlab',
    },
  });
}

export async function getCustomer(customerId: string): Promise<Stripe.Customer | null> {
  const stripe = getStripeClient();

  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (customer.deleted) return null;
    return customer as Stripe.Customer;
  } catch {
    return null;
  }
}

export async function getOrCreateCustomer(
  userId: string,
  email: string,
  name?: string,
  existingCustomerId?: string
): Promise<Stripe.Customer> {
  const stripe = getStripeClient();

  // Try to get existing customer
  if (existingCustomerId) {
    const existing = await getCustomer(existingCustomerId);
    if (existing) return existing;
  }

  // Search by email
  const customers = await stripe.customers.list({
    email,
    limit: 1,
  });

  if (customers.data.length > 0) {
    return customers.data[0];
  }

  // Create new customer
  return createCustomer(email, name, { userId });
}

// =============================================================================
// CHECKOUT SESSIONS
// =============================================================================

export interface CreateCheckoutOptions {
  customerId: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  trialDays?: number;
  metadata?: Record<string, string>;
}

export async function createCheckoutSession(
  options: CreateCheckoutOptions
): Promise<Stripe.Checkout.Session> {
  const stripe = getStripeClient();

  const sessionParams: Stripe.Checkout.SessionCreateParams = {
    customer: options.customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: [
      {
        price: options.priceId,
        quantity: 1,
      },
    ],
    success_url: options.successUrl,
    cancel_url: options.cancelUrl,
    metadata: options.metadata,
    subscription_data: options.trialDays
      ? {
          trial_period_days: options.trialDays,
          metadata: options.metadata,
        }
      : { metadata: options.metadata },
    allow_promotion_codes: true,
  };

  return stripe.checkout.sessions.create(sessionParams);
}

// =============================================================================
// SUBSCRIPTION MANAGEMENT
// =============================================================================

export async function getSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription | null> {
  const stripe = getStripeClient();

  try {
    return await stripe.subscriptions.retrieve(subscriptionId);
  } catch {
    return null;
  }
}

export async function cancelSubscription(
  subscriptionId: string,
  immediately = false
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  if (immediately) {
    return stripe.subscriptions.cancel(subscriptionId);
  }

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function reactivateSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripeClient();

  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;

  if (!itemId) {
    throw new Error('No subscription item found');
  }

  return stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: itemId,
        price: newPriceId,
      },
    ],
    proration_behavior: 'always_invoice',
  });
}

// =============================================================================
// BILLING PORTAL
// =============================================================================

export async function createBillingPortalSession(
  customerId: string,
  returnUrl: string
): Promise<Stripe.BillingPortal.Session> {
  const stripe = getStripeClient();

  return stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });
}

// =============================================================================
// WEBHOOK HANDLING
// =============================================================================

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripeClient();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }

  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

export function getPlanFromPriceId(priceId: string): SubscriptionPlan {
  if (priceId === STRIPE_PRICE_IDS.unlimited) return 'unlimited';
  return 'free';
}

// =============================================================================
// TYPES FOR WEBHOOK EVENTS
// =============================================================================

export interface SubscriptionWebhookData {
  subscriptionId: string;
  customerId: string;
  status: Stripe.Subscription.Status;
  plan: SubscriptionPlan;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export function parseSubscriptionEvent(
  subscription: Stripe.Subscription
): SubscriptionWebhookData {
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price.id || '';

  // Stripe API 2026-01-28.clover moved period fields from subscription to item level
  const periodStart = firstItem?.current_period_start ?? 0;
  const periodEnd = firstItem?.current_period_end ?? 0;

  return {
    subscriptionId: subscription.id,
    customerId: subscription.customer as string,
    status: subscription.status,
    plan: getPlanFromPriceId(priceId),
    currentPeriodStart: new Date(periodStart * 1000),
    currentPeriodEnd: new Date(periodEnd * 1000),
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
  };
}
