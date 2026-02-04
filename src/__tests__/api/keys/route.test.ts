/**
 * @jest-environment node
 */
import { POST, GET } from '@/app/api/keys/route';

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  order: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

describe('API Keys Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.order.mockReturnValue(mockSupabaseClient);
  });

  describe('POST /api/keys', () => {
    it('should return 401 if not authenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);
      const request = new Request('http://localhost:3000/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('should create an API key and return the raw key', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.single.mockResolvedValueOnce({
        data: { id: 'key-uuid', name: 'Test Key', created_at: '2025-02-01' },
        error: null,
      });

      const request = new Request('http://localhost:3000/api/keys', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test Key' }),
      });
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.key).toMatch(/^ml_live_/);
      expect(data.name).toBe('Test Key');
      expect(data.id).toBe('key-uuid');
    });
  });

  describe('GET /api/keys', () => {
    it('should list API keys without exposing hashes', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
      mockSupabaseClient.order.mockResolvedValueOnce({
        data: [{ id: 'k1', name: 'Key 1', key_prefix: 'ab12', is_active: true, last_used_at: null, created_at: '2025-02-01' }],
        error: null,
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.keys[0]).not.toHaveProperty('key_hash');
      expect(data.keys[0].prefix).toBe('ab12');
    });
  });
});
