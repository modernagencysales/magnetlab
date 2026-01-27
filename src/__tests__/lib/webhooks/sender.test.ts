import { deliverWebhook } from '@/lib/webhooks/sender';

// Mock Supabase
interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  eq: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  eq: jest.fn(),
};

// Setup chain methods
mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

describe('Webhook Sender', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockReset();
  });

  const mockWebhookData = {
    leadId: 'lead-123',
    email: 'test@example.com',
    name: 'John Doe',
    isQualified: true,
    qualificationAnswers: { 'q-1': 'yes' },
    leadMagnetTitle: 'Free Guide',
    funnelPageSlug: 'my-funnel',
    utmSource: 'linkedin',
    utmMedium: 'social',
    utmCampaign: 'launch',
    createdAt: '2025-01-26T00:00:00Z',
  };

  it('should not make any requests if no webhooks are configured', async () => {
    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: [],
      error: null,
    });

    await deliverWebhook('user-123', 'lead.created', mockWebhookData);

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should deliver to all active webhooks', async () => {
    const mockWebhooks = [
      { id: 'wh-1', url: 'https://example1.com/webhook', name: 'Webhook 1' },
      { id: 'wh-2', url: 'https://example2.com/webhook', name: 'Webhook 2' },
    ];

    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: mockWebhooks,
      error: null,
    });

    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await deliverWebhook('user-123', 'lead.created', mockWebhookData);

    expect(global.fetch).toHaveBeenCalledTimes(2);

    // Check first webhook call
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example1.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          'X-Webhook-Event': 'lead.created',
          'X-Webhook-Id': 'wh-1',
        }),
      })
    );

    // Check second webhook call
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example2.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'X-Webhook-Id': 'wh-2',
        }),
      })
    );
  });

  it('should include correct payload structure', async () => {
    const mockWebhooks = [
      { id: 'wh-1', url: 'https://example.com/webhook', name: 'Test' },
    ];

    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: mockWebhooks,
      error: null,
    });

    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await deliverWebhook('user-123', 'lead.created', mockWebhookData);

    const callArgs = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(callArgs[1].body);

    expect(body).toMatchObject({
      event: 'lead.created',
      timestamp: expect.any(String),
      data: mockWebhookData,
    });
  });

  it('should handle webhook delivery failures gracefully with retries', async () => {
    const mockWebhooks = [
      { id: 'wh-1', url: 'https://example.com/webhook', name: 'Test' },
    ];

    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: mockWebhooks,
      error: null,
    });

    // Fail with 500 (retryable) all times
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    // Should not throw
    await expect(
      deliverWebhook('user-123', 'lead.created', mockWebhookData)
    ).resolves.not.toThrow();

    // Should retry 3 times
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should not retry on 4xx client errors', async () => {
    const mockWebhooks = [
      { id: 'wh-1', url: 'https://example.com/webhook', name: 'Test' },
    ];

    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: mockWebhooks,
      error: null,
    });

    // 400 Bad Request is not retryable
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 400 });

    await deliverWebhook('user-123', 'lead.created', mockWebhookData);

    // Should only try once for non-retryable errors
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('should retry on network errors', async () => {
    const mockWebhooks = [
      { id: 'wh-1', url: 'https://example.com/webhook', name: 'Test' },
    ];

    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: mockWebhooks,
      error: null,
    });

    (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

    // Should not throw
    await expect(
      deliverWebhook('user-123', 'lead.created', mockWebhookData)
    ).resolves.not.toThrow();

    // Should retry 3 times
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  it('should succeed on retry after initial failure', async () => {
    const mockWebhooks = [
      { id: 'wh-1', url: 'https://example.com/webhook', name: 'Test' },
    ];

    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: mockWebhooks,
      error: null,
    });

    // Fail first attempt, succeed on second
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: true });

    await deliverWebhook('user-123', 'lead.created', mockWebhookData);

    // Should stop after success
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('should handle Supabase errors gracefully', async () => {
    mockSupabaseClient.eq.mockResolvedValueOnce({
      data: null,
      error: { message: 'Database error' },
    });

    // Should not throw
    await expect(
      deliverWebhook('user-123', 'lead.created', mockWebhookData)
    ).resolves.not.toThrow();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});
