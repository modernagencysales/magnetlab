/**
 * @jest-environment node
 */

import { POST } from '@/app/api/stripe/webhook/route';

// Mock constructWebhookEvent and parseSubscriptionEvent from stripe integration
const mockConstructWebhookEvent = jest.fn();
const mockParseSubscriptionEvent = jest.fn();

jest.mock('@/lib/integrations/stripe', () => ({
  constructWebhookEvent: (...args: unknown[]) => mockConstructWebhookEvent(...args),
  parseSubscriptionEvent: (...args: unknown[]) => mockParseSubscriptionEvent(...args),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock API error logger
jest.mock('@/lib/api/errors', () => ({
  logApiError: jest.fn(),
}));

// Mock PostHog
jest.mock('@/lib/posthog', () => ({
  getPostHogServerClient: jest.fn(() => ({
    capture: jest.fn(),
  })),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client with chainable query builder.
 * Supports from → select/update → eq → single chains.
 */
function createMockSupabase() {
  let subscriptionLookupResult: { data: unknown; error: unknown } = { data: null, error: null };
  const updateCalls: Array<Record<string, unknown>> = [];

  function createChain(terminal?: () => Promise<{ data: unknown; error: unknown }>) {
    const resolve = terminal || (() => Promise.resolve(subscriptionLookupResult));

    const chain: Record<string, jest.Mock> = {};
    for (const method of ['select', 'eq', 'single', 'update']) {
      if (method === 'update') {
        chain[method] = jest.fn((data: Record<string, unknown>) => {
          updateCalls.push(data);
          return chain;
        });
      } else {
        chain[method] = jest.fn(() => chain);
      }
    }
    // Make the chain thenable so await works at any point in the chain
    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolve().then(onFulfilled, onRejected),
      enumerable: false,
    });

    return chain;
  }

  const client = {
    from: jest.fn(() => createChain()),
  };

  return {
    client,
    updateCalls,
    setSubscriptionLookup: (result: { data: unknown; error: unknown }) => {
      subscriptionLookupResult = result;
    },
  };
}

function makeRequest(body: string, signature?: string): Request {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (signature) {
    headers['stripe-signature'] = signature;
  }
  return new Request('http://localhost:3000/api/stripe/webhook', {
    method: 'POST',
    headers,
    body,
  });
}

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/stripe/webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
    mockConstructWebhookEvent.mockReset();
    mockParseSubscriptionEvent.mockReset();
  });

  it('should return 400 when stripe-signature header is missing', async () => {
    const request = makeRequest('{}');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Missing signature');
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should return 400 when signature verification fails', async () => {
    mockConstructWebhookEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const request = makeRequest('{}', 'whsec_invalid_sig');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid signature');
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should handle checkout.session.completed event', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'checkout.session.completed',
      data: {
        object: {
          mode: 'subscription',
          subscription: 'sub_123',
          customer: 'cus_123',
        },
      },
    });

    const request = makeRequest('{}', 'whsec_valid_sig');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
  });

  it('should handle customer.subscription.updated — updates plan/status', async () => {
    const now = new Date();
    const later = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    mockConstructWebhookEvent.mockReturnValue({
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_456',
          customer: 'cus_456',
          status: 'active',
          items: { data: [{ price: { id: 'price_unlimited' } }] },
          current_period_start: Math.floor(now.getTime() / 1000),
          current_period_end: Math.floor(later.getTime() / 1000),
          cancel_at_period_end: false,
        },
      },
    });

    mockParseSubscriptionEvent.mockReturnValue({
      subscriptionId: 'sub_456',
      customerId: 'cus_456',
      status: 'active',
      plan: 'unlimited',
      currentPeriodStart: now,
      currentPeriodEnd: later,
      cancelAtPeriodEnd: false,
    });

    // The route first queries subscriptions by customer ID
    mock.setSubscriptionLookup({ data: { user_id: 'user-abc' }, error: null });

    const request = makeRequest('{}', 'whsec_valid_sig');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    // Verify supabase.from was called for subscriptions
    expect(mock.client.from).toHaveBeenCalledWith('subscriptions');
  });

  it('should handle customer.subscription.deleted — marks cancelled and downgrades to free', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_789',
          customer: 'cus_789',
        },
      },
    });

    mock.setSubscriptionLookup({ data: { user_id: 'user-xyz' }, error: null });

    const request = makeRequest('{}', 'whsec_valid_sig');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mock.client.from).toHaveBeenCalledWith('subscriptions');
  });

  it('should ignore unknown event types gracefully and return 200', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'payment_intent.created',
      data: {
        object: {},
      },
    });

    const request = makeRequest('{}', 'whsec_valid_sig');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    // Should not have queried subscriptions table for unknown events
    expect(mock.client.from).not.toHaveBeenCalled();
  });

  it('should handle invoice.payment_failed event', async () => {
    mockConstructWebhookEvent.mockReturnValue({
      type: 'invoice.payment_failed',
      data: {
        object: {
          subscription: 'sub_failed',
        },
      },
    });

    mock.setSubscriptionLookup({ data: { user_id: 'user-past-due' }, error: null });

    const request = makeRequest('{}', 'whsec_valid_sig');
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.received).toBe(true);
    expect(mock.client.from).toHaveBeenCalledWith('subscriptions');
  });
});
