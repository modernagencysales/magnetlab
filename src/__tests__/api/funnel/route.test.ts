/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/funnel/route';

// Mock modules
interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  eq: jest.Mock;
  single: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

describe('Funnel API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chain methods
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
  });

  describe('GET /api/funnel', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/funnel?leadMagnetId=123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if leadMagnetId is missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/funnel');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('leadMagnetId is required');
    });

    it('should return 404 if lead magnet not found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/funnel?leadMagnetId=123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead magnet not found');
    });

    it('should return funnel page if found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      // Lead magnet exists
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'lm-123' }, error: null })
        // Funnel page exists
        .mockResolvedValueOnce({
          data: {
            id: 'funnel-123',
            lead_magnet_id: 'lm-123',
            user_id: 'user-123',
            slug: 'my-funnel',
            optin_headline: 'Get Free Access',
            optin_subline: null,
            optin_button_text: 'Get Access',
            optin_social_proof: null,
            thankyou_headline: 'Thanks!',
            thankyou_subline: null,
            vsl_url: null,
            calendly_url: null,
            qualification_pass_message: 'Great!',
            qualification_fail_message: 'Not a fit',
            is_published: false,
            published_at: null,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/funnel?leadMagnetId=lm-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.funnel).toBeDefined();
      expect(data.funnel.id).toBe('funnel-123');
      expect(data.funnel.slug).toBe('my-funnel');
    });

    it('should return null funnel if not found but lead magnet exists', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'lm-123' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const request = new Request('http://localhost:3000/api/funnel?leadMagnetId=lm-123');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.funnel).toBeNull();
    });
  });

  describe('POST /api/funnel', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: '123', slug: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if required fields are missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: '123' }), // missing slug
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('leadMagnetId and slug are required');
    });

    it('should return 404 if lead magnet not found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: '123', slug: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead magnet not found');
    });

    it('should return 409 if funnel already exists for lead magnet', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'lm-123', title: 'My Lead Magnet' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'existing-funnel' }, error: null });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: 'lm-123', slug: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toBe('Funnel page already exists for this lead magnet');
    });

    it('should create funnel page successfully', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        // Lead magnet exists
        .mockResolvedValueOnce({ data: { id: 'lm-123', title: 'My Lead Magnet' }, error: null })
        // No existing funnel
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // No slug collision
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // Created funnel
        .mockResolvedValueOnce({
          data: {
            id: 'new-funnel-123',
            lead_magnet_id: 'lm-123',
            user_id: 'user-123',
            slug: 'test',
            optin_headline: 'My Lead Magnet',
            optin_subline: null,
            optin_button_text: 'Get Free Access',
            optin_social_proof: null,
            thankyou_headline: 'Thanks! Check your email.',
            thankyou_subline: null,
            vsl_url: null,
            calendly_url: null,
            qualification_pass_message: 'Great! Book a call below.',
            qualification_fail_message: 'Thanks for your interest!',
            is_published: false,
            published_at: null,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({
          leadMagnetId: 'lm-123',
          slug: 'test',
          optinHeadline: 'Custom Headline',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.funnel).toBeDefined();
      expect(data.funnel.id).toBe('new-funnel-123');
    });

    it('should auto-increment slug if collision detected', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'lm-123', title: 'My Lead Magnet' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // Slug collision on first try
        .mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
        // No collision on second try (test-1)
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({
          data: {
            id: 'new-funnel',
            slug: 'test-1',
            lead_magnet_id: 'lm-123',
            user_id: 'user-123',
            optin_headline: 'Test',
            optin_subline: null,
            optin_button_text: 'Get Free Access',
            optin_social_proof: null,
            thankyou_headline: 'Thanks!',
            thankyou_subline: null,
            vsl_url: null,
            calendly_url: null,
            qualification_pass_message: 'Great!',
            qualification_fail_message: 'Thanks!',
            is_published: false,
            published_at: null,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: 'lm-123', slug: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.funnel.slug).toBe('test-1');
    });
  });
});
