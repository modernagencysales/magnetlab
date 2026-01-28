/**
 * @jest-environment node
 */

import { POST, PATCH } from '@/app/api/public/lead/route';

// Mock modules
interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/webhooks/sender', () => ({
  deliverWebhook: jest.fn(() => Promise.resolve()),
}));

jest.mock('@/lib/services/email-sequence-trigger', () => ({
  triggerEmailSequenceIfActive: jest.fn(() => Promise.resolve()),
}));

describe('Public Lead Capture API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup chain methods after clearing - these return the mock client for chaining
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    // Default single to return empty data - tests override as needed
    mockSupabaseClient.single.mockResolvedValue({ data: null, error: null });
  });

  describe('POST /api/public/lead', () => {
    it('should return 400 if funnelPageId is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@example.com' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('funnelPageId and email are required');
    });

    it('should return 400 if email is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ funnelPageId: 'funnel-123' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('funnelPageId and email are required');
    });

    it('should return 400 for invalid email format', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'funnel-123',
          email: 'invalid-email',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid email format');
    });

    it('should return 404 if funnel page not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'nonexistent',
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should return 404 if funnel page is not published', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'funnel-123',
          user_id: 'user-123',
          lead_magnet_id: 'lm-123',
          slug: 'test',
          is_published: false,
        },
        error: null,
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'funnel-123',
          email: 'test@example.com',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Page not found');
    });

    it('should create lead successfully', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'funnel-123',
            user_id: 'user-123',
            lead_magnet_id: 'lm-123',
            slug: 'test',
            is_published: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            id: 'lead-123',
            email: 'test@example.com',
            name: 'John Doe',
            utm_source: 'linkedin',
            utm_medium: 'social',
            utm_campaign: 'launch',
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { title: 'My Lead Magnet' },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'funnel-123',
          email: 'TEST@EXAMPLE.COM', // Should be lowercased
          name: '  John Doe  ', // Should be trimmed
          utmSource: 'linkedin',
          utmMedium: 'social',
          utmCampaign: 'launch',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.leadId).toBe('lead-123');
      expect(data.success).toBe(true);
    });

    it('should normalize email to lowercase and trim name', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'funnel-123',
            user_id: 'user-123',
            lead_magnet_id: 'lm-123',
            slug: 'test',
            is_published: true,
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'lead-123', email: 'test@example.com', created_at: '2025-01-26T00:00:00Z' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { title: 'Test' },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          funnelPageId: 'funnel-123',
          email: '  TEST@Example.COM  ',
        }),
      });

      await POST(request);

      // Check that insert was called with normalized email
      expect(mockSupabaseClient.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'test@example.com',
        })
      );
    });
  });

  describe('PATCH /api/public/lead', () => {
    it('should return 400 if leadId is missing', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: {} }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('leadId and answers are required');
    });

    it('should return 400 if answers is not an object', async () => {
      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: 'lead-123', answers: 'invalid' }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(400);
    });

    it('should return 404 if lead not found', async () => {
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'nonexistent',
          answers: { 'q-1': 'yes' },
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead not found');
    });

    it('should determine qualification based on answers', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'lead-123',
            funnel_page_id: 'funnel-123',
            user_id: 'user-123',
            email: 'test@example.com',
            name: 'Test',
          },
          error: null,
        });

      // Mock questions query (returns array, not single)
      const mockQuestionsResult = {
        data: [
          { id: 'q-1', qualifying_answer: 'yes' },
          { id: 'q-2', qualifying_answer: 'no' },
        ],
        error: null,
      };
      mockSupabaseClient.select.mockReturnValueOnce({
        ...mockSupabaseClient,
        eq: jest.fn().mockResolvedValueOnce(mockQuestionsResult),
      });

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'lead-123',
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { slug: 'test', lead_magnet_id: 'lm-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { title: 'Test Lead Magnet' },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-123',
          answers: { 'q-1': 'yes', 'q-2': 'no' }, // Both match qualifying answers
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isQualified).toBe(true);
      expect(data.success).toBe(true);
    });

    it('should mark as not qualified if any answer does not match', async () => {
      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'lead-123',
            funnel_page_id: 'funnel-123',
            user_id: 'user-123',
            email: 'test@example.com',
            name: 'Test',
          },
          error: null,
        });

      const mockQuestionsResult = {
        data: [
          { id: 'q-1', qualifying_answer: 'yes' },
          { id: 'q-2', qualifying_answer: 'yes' }, // Needs 'yes'
        ],
        error: null,
      };
      mockSupabaseClient.select.mockReturnValueOnce({
        ...mockSupabaseClient,
        eq: jest.fn().mockResolvedValueOnce(mockQuestionsResult),
      });

      mockSupabaseClient.single
        .mockResolvedValueOnce({
          data: {
            id: 'lead-123',
            utm_source: null,
            utm_medium: null,
            utm_campaign: null,
            created_at: '2025-01-26T00:00:00Z',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { slug: 'test', lead_magnet_id: 'lm-123' },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { title: 'Test' },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/public/lead', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: 'lead-123',
          answers: { 'q-1': 'yes', 'q-2': 'no' }, // q-2 doesn't match
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.isQualified).toBe(false);
    });
  });
});
