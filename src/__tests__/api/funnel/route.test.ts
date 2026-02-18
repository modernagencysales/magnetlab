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
  or: jest.Mock;
  single: jest.Mock;
  range: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  or: jest.fn(),
  single: jest.fn(),
  range: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

// Mock team-context (routes now use getDataScope/applyScope for multi-team scoping)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyScope: jest.fn((query: any, scope: any) => query.eq('user_id', scope.userId)),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// Mock plan-limits to always allow resource creation
jest.mock('@/lib/auth/plan-limits', () => ({
  checkResourceLimit: jest.fn().mockResolvedValue({ allowed: true, current: 0, limit: 3 }),
}));

const validUUID = '550e8400-e29b-41d4-a716-446655440000';

describe('Funnel API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset chain methods
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.or.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.range.mockReturnValue(mockSupabaseClient);
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

    it('should return 400 if no target ID is provided', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/funnel');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('One of leadMagnetId, libraryId, or externalResourceId is required');
    });

    it('should return 400 if leadMagnetId is not a valid UUID', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/funnel?leadMagnetId=abc');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid leadMagnetId');
    });

    it('should return 404 if lead magnet not found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request(`http://localhost:3000/api/funnel?leadMagnetId=${validUUID}`);
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead magnet not found');
    });

    it('should return funnel page if found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      // Lead magnet exists
      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: validUUID }, error: null })
        // Funnel page exists
        .mockResolvedValueOnce({
          data: {
            id: 'funnel-123',
            lead_magnet_id: validUUID,
            user_id: 'user-123',
            slug: 'my-funnel',
            target_type: 'lead_magnet',
            library_id: null,
            external_resource_id: null,
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
            theme: 'dark',
            primary_color: '#8b5cf6',
            background_style: 'solid',
            logo_url: null,
            qualification_form_id: null,
            is_published: false,
            published_at: null,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request(`http://localhost:3000/api/funnel?leadMagnetId=${validUUID}`);
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
        .mockResolvedValueOnce({ data: { id: validUUID }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const request = new Request(`http://localhost:3000/api/funnel?leadMagnetId=${validUUID}`);
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
        body: JSON.stringify({ leadMagnetId: validUUID }), // missing slug
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('slug is required');
    });

    it('should return 404 if lead magnet not found', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' },
      });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: validUUID, slug: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Lead magnet not found');
    });

    it('should return 409 if funnel already exists for lead magnet', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: validUUID, title: 'My Lead Magnet' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'existing-funnel' }, error: null });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: validUUID, slug: 'test' }),
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
        .mockResolvedValueOnce({ data: { id: validUUID, title: 'My Lead Magnet' }, error: null })
        // No existing funnel
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // User profile (no theme defaults set)
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // Created funnel (after slug check via .or() which returns via the or mock)
        .mockResolvedValueOnce({
          data: {
            id: 'new-funnel-123',
            lead_magnet_id: validUUID,
            user_id: 'user-123',
            slug: 'test',
            target_type: 'lead_magnet',
            library_id: null,
            external_resource_id: null,
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
            theme: 'dark',
            primary_color: '#8b5cf6',
            background_style: 'solid',
            logo_url: null,
            qualification_form_id: null,
            is_published: false,
            published_at: null,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      // Slug collision check uses .or() which returns the mock chain, then resolves via Supabase
      // The route does: supabase.from('funnel_pages').select('slug').eq('user_id', ...).or(...)
      // The .or() returns mockSupabaseClient which then resolves (no .single() here, just the chain)
      // We need to make .or() resolve the query - it returns a promise-like with {data, error}
      mockSupabaseClient.or.mockResolvedValueOnce({ data: [], error: null });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({
          leadMagnetId: validUUID,
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
        .mockResolvedValueOnce({ data: { id: validUUID, title: 'My Lead Magnet' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // User profile (no theme defaults set)
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        // Created funnel with slug test-1
        .mockResolvedValueOnce({
          data: {
            id: 'new-funnel',
            slug: 'test-1',
            lead_magnet_id: validUUID,
            user_id: 'user-123',
            target_type: 'lead_magnet',
            library_id: null,
            external_resource_id: null,
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
            theme: 'dark',
            primary_color: '#8b5cf6',
            background_style: 'solid',
            logo_url: null,
            qualification_form_id: null,
            is_published: false,
            published_at: null,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      // Slug collision: 'test' already exists
      mockSupabaseClient.or.mockResolvedValueOnce({
        data: [{ slug: 'test' }],
        error: null,
      });

      const request = new Request('http://localhost:3000/api/funnel', {
        method: 'POST',
        body: JSON.stringify({ leadMagnetId: validUUID, slug: 'test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.funnel.slug).toBe('test-1');
    });
  });
});
