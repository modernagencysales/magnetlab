/**
 * @jest-environment node
 */

import { POST } from '@/app/api/accelerator/enroll/route';

// Mock auth
const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock stripe integration
const mockGetOrCreateCustomer = jest.fn();
const mockCreateCheckoutSession = jest.fn();
jest.mock('@/lib/integrations/stripe', () => ({
  getOrCreateCustomer: (...args: unknown[]) => mockGetOrCreateCustomer(...args),
  createCheckoutSession: (...args: unknown[]) => mockCreateCheckoutSession(...args),
}));

// Mock enrollment service
const mockHasAccess = jest.fn();
jest.mock('@/lib/services/accelerator-enrollment', () => ({
  hasAcceleratorAccess: (...args: unknown[]) => mockHasAccess(...args),
  ACCELERATOR_STRIPE_PRICE_ID: 'price_test_accel',
}));

// Mock API errors
jest.mock('@/lib/api/errors', () => ({
  ApiErrors: {
    unauthorized: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    validationError: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 400 }),
    internalError: (msg: string) => new Response(JSON.stringify({ error: msg }), { status: 500 }),
  },
  logApiError: jest.fn(),
}));

describe('POST /api/accelerator/enroll', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const response = await POST();
    expect(response.status).toBe(401);
  });

  it('returns 400 when user already has access', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    });
    mockHasAccess.mockResolvedValue(true);

    const response = await POST();
    const data = await response.json();
    expect(response.status).toBe(400);
    expect(data.error).toContain('already enrolled');
  });

  it('creates checkout session for new user', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    });
    mockHasAccess.mockResolvedValue(false);
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_123' });
    mockCreateCheckoutSession.mockResolvedValue({
      url: 'https://checkout.stripe.com/session_123',
    });

    const response = await POST();
    const data = await response.json();
    expect(response.status).toBe(200);
    expect(data.url).toContain('checkout.stripe.com');
  });

  it('passes correct metadata to checkout session', async () => {
    mockAuth.mockResolvedValue({
      user: { id: 'user-1', email: 'test@example.com', name: 'Test' },
    });
    mockHasAccess.mockResolvedValue(false);
    mockGetOrCreateCustomer.mockResolvedValue({ id: 'cus_123' });
    mockCreateCheckoutSession.mockResolvedValue({ url: 'https://checkout.stripe.com/x' });

    await POST();

    expect(mockCreateCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          userId: 'user-1',
          product: 'accelerator',
        }),
      })
    );
  });
});
