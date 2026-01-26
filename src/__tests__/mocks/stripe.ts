// Stripe mock for testing
import { vi } from 'vitest';
import type Stripe from 'stripe';

// Mock Stripe customer
export const mockStripeCustomer: Partial<Stripe.Customer> = {
  id: 'cus_test123',
  email: 'test@example.com',
  name: 'Test User',
  metadata: { userId: 'test-user-id-123', source: 'magnetlab' },
  deleted: undefined,
};

// Mock Stripe subscription
export const mockStripeSubscription: Partial<Stripe.Subscription> = {
  id: 'sub_test123',
  customer: 'cus_test123',
  status: 'active',
  current_period_start: Math.floor(Date.now() / 1000),
  current_period_end: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  cancel_at_period_end: false,
  items: {
    data: [
      {
        id: 'si_test123',
        price: {
          id: 'price_pro_test',
          product: 'prod_test123',
        } as Stripe.Price,
      } as Stripe.SubscriptionItem,
    ],
    object: 'list',
    has_more: false,
    url: '/v1/subscription_items',
  },
};

// Mock Stripe checkout session
export const mockCheckoutSession: Partial<Stripe.Checkout.Session> = {
  id: 'cs_test123',
  customer: 'cus_test123',
  mode: 'subscription',
  subscription: 'sub_test123',
  success_url: 'https://app.test.com/success',
  cancel_url: 'https://app.test.com/cancel',
  url: 'https://checkout.stripe.com/test',
};

// Mock Stripe invoice
export const mockStripeInvoice: Partial<Stripe.Invoice> = {
  id: 'in_test123',
  customer: 'cus_test123',
  subscription: 'sub_test123',
  status: 'open',
  amount_due: 4900,
  currency: 'usd',
};

// Create mock Stripe webhook events
export const createMockWebhookEvent = (
  type: string,
  data: Record<string, unknown>
) => ({
  id: `evt_test_${Date.now()}`,
  object: 'event' as const,
  api_version: '2025-02-24.acacia' as const,
  created: Math.floor(Date.now() / 1000),
  type: type,
  data: {
    object: data,
  },
  livemode: false,
  pending_webhooks: 0,
  request: { id: 'req_test', idempotency_key: null },
}) as unknown as Stripe.Event;

// Mock Stripe client
export const createMockStripeClient = () => {
  return {
    customers: {
      create: vi.fn().mockResolvedValue(mockStripeCustomer),
      retrieve: vi.fn().mockResolvedValue(mockStripeCustomer),
      list: vi.fn().mockResolvedValue({ data: [mockStripeCustomer] }),
    },
    subscriptions: {
      retrieve: vi.fn().mockResolvedValue(mockStripeSubscription),
      update: vi.fn().mockResolvedValue(mockStripeSubscription),
      cancel: vi.fn().mockResolvedValue({ ...mockStripeSubscription, status: 'canceled' }),
    },
    checkout: {
      sessions: {
        create: vi.fn().mockResolvedValue(mockCheckoutSession),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn().mockResolvedValue({
          id: 'bps_test123',
          url: 'https://billing.stripe.com/test',
        }),
      },
    },
    webhooks: {
      constructEvent: vi.fn().mockImplementation((payload, signature, secret) => {
        if (signature === 'invalid_signature') {
          throw new Error('Webhook signature verification failed');
        }
        return JSON.parse(typeof payload === 'string' ? payload : payload.toString());
      }),
    },
  };
};

// Helper to create subscription webhook events
export const createSubscriptionCreatedEvent = (
  subscription: Partial<Stripe.Subscription> = mockStripeSubscription
): Stripe.Event =>
  createMockWebhookEvent('customer.subscription.created', subscription);

export const createSubscriptionUpdatedEvent = (
  subscription: Partial<Stripe.Subscription> = mockStripeSubscription
): Stripe.Event =>
  createMockWebhookEvent('customer.subscription.updated', subscription);

export const createSubscriptionDeletedEvent = (
  subscription: Partial<Stripe.Subscription> = mockStripeSubscription
): Stripe.Event =>
  createMockWebhookEvent('customer.subscription.deleted', subscription);

export const createPaymentFailedEvent = (
  invoice: Partial<Stripe.Invoice> = mockStripeInvoice
): Stripe.Event => createMockWebhookEvent('invoice.payment_failed', invoice);

export const createCheckoutCompletedEvent = (
  session: Partial<Stripe.Checkout.Session> = mockCheckoutSession
): Stripe.Event => createMockWebhookEvent('checkout.session.completed', session);
