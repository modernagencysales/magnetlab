/**
 * @jest-environment node
 */
import { POST } from '@/app/api/funnel/bulk/route';

const mockSupabaseClient = {
  from: jest.fn(),
  select: jest.fn(),
  insert: jest.fn(),
  eq: jest.fn(),
  single: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/auth/api-key', () => ({
  resolveUserId: jest.fn(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn().mockResolvedValue({ type: 'personal', userId: 'user-123', teamId: null }),
}));

import { resolveUserId } from '@/lib/auth/api-key';
const mockResolveUserId = resolveUserId as jest.MockedFunction<typeof resolveUserId>;

describe('POST /api/funnel/bulk', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseClient.from.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.select.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.insert.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.eq.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.update.mockReturnValue(mockSupabaseClient);
    mockSupabaseClient.delete.mockReturnValue(mockSupabaseClient);
  });

  it('should return 401 if not authenticated', async () => {
    mockResolveUserId.mockResolvedValueOnce(null);
    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({ pages: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('should return 400 if pages array is empty', async () => {
    mockResolveUserId.mockResolvedValueOnce('user-123');
    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({ pages: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should return 400 if a page is missing required fields', async () => {
    mockResolveUserId.mockResolvedValueOnce('user-123');
    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({ pages: [{ title: 'Test' }] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('should create pages and return results', async () => {
    mockResolveUserId.mockResolvedValueOnce('user-123');

    // Mock user profile defaults
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: {
        default_theme: 'dark',
        default_primary_color: '#8b5cf6',
        default_background_style: 'solid',
        default_logo_url: null,
        username: 'testuser',
      },
      error: null,
    });

    // Mock slug check (no collision)
    mockSupabaseClient.single.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

    // Mock lead magnet insert
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'lm-1' },
      error: null,
    });

    // Mock funnel page insert
    mockSupabaseClient.single.mockResolvedValueOnce({
      data: { id: 'fp-1', slug: 'test-page' },
      error: null,
    });

    const request = new Request('http://localhost:3000/api/funnel/bulk', {
      method: 'POST',
      body: JSON.stringify({
        pages: [
          {
            title: 'Test Page',
            optinHeadline: 'Get the guide',
            leadMagnetUrl: 'https://example.com/guide.pdf',
          },
        ],
      }),
    });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.created).toBe(1);
    expect(data.failed).toBe(0);
    expect(data.results[0].status).toBe('created');
  });
});
