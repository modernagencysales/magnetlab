/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/external-resources/route';

interface MockSupabaseClient {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  range: jest.Mock;
  single: jest.Mock;
}

const mockSupabaseClient: MockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  order: jest.fn(),
  range: jest.fn(),
  single: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

describe('External Resources API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.range.mockReturnValue(mockSupabaseClient);
  });

  describe('GET /api/external-resources', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await GET(new Request('http://localhost/api/external-resources'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return external resources for authenticated user', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const mockResources = [
        {
          id: 'res-1',
          user_id: 'user-123',
          title: 'YouTube Tutorial',
          url: 'https://youtube.com/watch?v=123',
          icon: '📹',
          click_count: 42,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
        },
      ];

      mockSupabaseClient.range.mockResolvedValueOnce({
        data: mockResources,
        error: null,
      });

      const response = await GET(new Request('http://localhost/api/external-resources'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resources).toHaveLength(1);
      expect(data.resources[0].title).toBe('YouTube Tutorial');
      expect(data.resources[0].clickCount).toBe(42);
    });

    it('should return empty array if no resources', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.range.mockResolvedValueOnce({ data: [], error: null });

      const response = await GET(new Request('http://localhost/api/external-resources'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.resources).toHaveLength(0);
    });
  });

  describe('POST /api/external-resources', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/external-resources', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', url: 'https://example.com' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if title is missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/external-resources', {
        method: 'POST',
        body: JSON.stringify({ url: 'https://example.com' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('title is required');
    });

    it('should return 400 if url is missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/external-resources', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test Resource' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('url is required');
    });

    it('should return 400 if url is invalid', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/external-resources', {
        method: 'POST',
        body: JSON.stringify({ title: 'Test', url: 'not-a-valid-url' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('url must be a valid URL');
    });

    it('should create external resource successfully', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'res-new',
          user_id: 'user-123',
          title: 'New Resource',
          url: 'https://example.com/resource',
          icon: '🔗',
          click_count: 0,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
        },
        error: null,
      });

      const request = new Request('http://localhost:3000/api/external-resources', {
        method: 'POST',
        body: JSON.stringify({
          title: 'New Resource',
          url: 'https://example.com/resource',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.resource).toBeDefined();
      expect(data.resource.title).toBe('New Resource');
      expect(data.resource.url).toBe('https://example.com/resource');
    });

    it('should use custom icon', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single.mockResolvedValueOnce({
        data: {
          id: 'res-new',
          user_id: 'user-123',
          title: 'Video Resource',
          url: 'https://youtube.com/watch?v=123',
          icon: '📹',
          click_count: 0,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
        },
        error: null,
      });

      const request = new Request('http://localhost:3000/api/external-resources', {
        method: 'POST',
        body: JSON.stringify({
          title: 'Video Resource',
          url: 'https://youtube.com/watch?v=123',
          icon: '📹',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.resource.icon).toBe('📹');
    });
  });
});
