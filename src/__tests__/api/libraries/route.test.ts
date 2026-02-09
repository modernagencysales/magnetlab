/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/libraries/route';

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

describe('Libraries API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.range.mockReturnValue(mockSupabaseClient);
  });

  describe('GET /api/libraries', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await GET(new Request('http://localhost/api/libraries'));
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return libraries for authenticated user', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const mockLibraries = [
        {
          id: 'lib-1',
          user_id: 'user-123',
          name: 'Marketing Resources',
          description: 'All marketing stuff',
          icon: '📚',
          slug: 'marketing-resources',
          auto_feature_days: 14,
          created_at: '2025-01-25T00:00:00Z',
          updated_at: '2025-01-25T00:00:00Z',
        },
      ];

      mockSupabaseClient.range.mockResolvedValueOnce({
        data: mockLibraries,
        error: null,
      });

      const response = await GET(new Request('http://localhost/api/libraries'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.libraries).toHaveLength(1);
      expect(data.libraries[0].name).toBe('Marketing Resources');
      expect(data.libraries[0].slug).toBe('marketing-resources');
    });

    it('should return empty array if no libraries', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.range.mockResolvedValueOnce({ data: [], error: null });

      const response = await GET(new Request('http://localhost/api/libraries'));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.libraries).toHaveLength(0);
    });
  });

  describe('POST /api/libraries', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const request = new Request('http://localhost:3000/api/libraries', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Library' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 400 if name is missing', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/libraries', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('name is required');
    });

    it('should return 400 if name is empty string', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      const request = new Request('http://localhost:3000/api/libraries', {
        method: 'POST',
        body: JSON.stringify({ name: '   ' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('name is required');
    });

    it('should create library with generated slug', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({
          data: {
            id: 'lib-new',
            user_id: 'user-123',
            name: 'My Test Library',
            description: null,
            icon: '📚',
            slug: 'my-test-library',
            auto_feature_days: 14,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/libraries', {
        method: 'POST',
        body: JSON.stringify({ name: 'My Test Library' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.library).toBeDefined();
      expect(data.library.name).toBe('My Test Library');
      expect(data.library.slug).toBe('my-test-library');
    });

    it('should auto-increment slug on collision', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: { id: 'existing' }, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({
          data: {
            id: 'lib-new',
            user_id: 'user-123',
            name: 'Test',
            description: null,
            icon: '📚',
            slug: 'test-1',
            auto_feature_days: 14,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/libraries', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.library.slug).toBe('test-1');
    });

    it('should use custom icon and description', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });

      mockSupabaseClient.single
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } })
        .mockResolvedValueOnce({
          data: {
            id: 'lib-new',
            user_id: 'user-123',
            name: 'Custom Library',
            description: 'My description',
            icon: '🎯',
            slug: 'custom-library',
            auto_feature_days: 14,
            created_at: '2025-01-25T00:00:00Z',
            updated_at: '2025-01-25T00:00:00Z',
          },
          error: null,
        });

      const request = new Request('http://localhost:3000/api/libraries', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Custom Library',
          description: 'My description',
          icon: '🎯',
        }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.library.icon).toBe('🎯');
      expect(data.library.description).toBe('My description');
    });
  });
});
