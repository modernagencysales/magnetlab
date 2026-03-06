/**
 * Stripe Service
 * Checkout session creation and webhook event handling. Uses subscription.repo.
 */

import Stripe from 'stripe';
import {
  createCheckoutSession,
  getOrCreateCustomer,
  STRIPE_PRICE_IDS,
  constructWebhookEvent,
  parseSubscriptionEvent,
} from '@/lib/integrations/stripe';
import type { SubscriptionPlan } from '@/lib/types/integrations';
import { getPostHogServerClient } from '@/lib/posthog';
import * as subscriptionRepo from '@/server/repositories/subscription.repo';

export async function createCheckout(
  userId: string,
  email: string,
  name: string | undefined,
  plan: Exclude<SubscriptionPlan, 'free'>,
): Promise<{ url: string | null }> {
  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) throw new Error('Plan not available');

  const subscription = await subscriptionRepo.getByUserId(userId);
  const customer = await getOrCreateCustomer(
    userId,
    email,
    name,
    subscription?.stripe_customer_id ?? undefined,
  );

  if (!subscription?.stripe_customer_id) {
    await subscriptionRepo.setStripeCustomerId(userId, customer.id);
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const session = await createCheckoutSession({
    customerId: customer.id,
    priceId,
    successUrl: `${appUrl}/settings?upgrade=success`,
    cancelUrl: `${appUrl}/settings?upgrade=canceled`,
    metadata: { userId, plan },
  });

  try {
    getPostHogServerClient()?.capture({
      distinctId: userId,
      event: 'checkout_initiated',
      properties: { plan },
    });
  } catch {
    // ignore
  }

  return { url: session.url };
}

export async function handleWebhookEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed':
      // Handled by subscription.created
      break;

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const data = parseSubscriptionEvent(subscription);
      const existing = await subscriptionRepo.getByStripeCustomerId(data.customerId);
      if (existing) {
        await subscriptionRepo.updateSubscription(existing.user_id, {
          stripe_subscription_id: data.subscriptionId,
          plan: data.plan,
          status:
            data.status === 'active'
              ? 'active'
              : data.status === 'canceled'
                ? 'canceled'
                : data.status === 'past_due'
                  ? 'past_due'
                  : 'active',
          current_period_start: data.currentPeriodStart.toISOString(),
          current_period_end: data.currentPeriodEnd.toISOString(),
          cancel_at_period_end: data.cancelAtPeriodEnd,
        });
        try {
          getPostHogServerClient()?.capture({
            distinctId: existing.user_id,
            event: 'subscription_updated',
            properties: { plan: data.plan, status: data.status },
          });
        } catch {
          // ignore
        }
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const existing = await subscriptionRepo.getByStripeSubscriptionId(subscription.id);
      if (existing) {
        await subscriptionRepo.updateSubscription(existing.user_id, {
          plan: 'free',
          status: 'canceled',
          stripe_subscription_id: null,
        });
        try {
          getPostHogServerClient()?.capture({
            distinctId: existing.user_id,
            event: 'subscription_canceled',
          });
        } catch {
          // ignore
        }
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = ((invoice as { parent?: { subscription_details?: { subscription?: string } } }).parent?.subscription_details?.subscription as string) || '';
      const existing = await subscriptionRepo.getByStripeSubscriptionId(subscriptionId);
      if (existing) {
        await subscriptionRepo.updateSubscription(existing.user_id, { status: 'past_due' });
        try {
          getPostHogServerClient()?.capture({
            distinctId: existing.user_id,
            event: 'payment_failed',
          });
        } catch {
          // ignore
        }
      }
      break;
    }
  }
}

export function verifyWebhookSignature(body: string, signature: string): Stripe.Event {
  return constructWebhookEvent(body, signature);
}
