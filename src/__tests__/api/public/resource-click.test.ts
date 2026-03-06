/**
 * @jest-environment node
 */

import { POST } from '@/app/api/public/resource-click/route';

// Mock Supabase
const mockInsert = jest.fn();
const mockSelect = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: jest.fn((table: string) => {
      if (table === 'external_resource_clicks') {
        return { insert: mockInsert };
      }
      if (table === 'funnel_pages') {
        return {
          select: mockSelect.mockReturnValue({
            eq: mockEq.mockReturnValue({
              single: mockSingle,
            }),
          }),
        };
      }
      return {};
    }),
  }),
}));

describe('POST /api/public/resource-click', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockSingle.mockResolvedValue({ data: null, error: null });
  });

  it('returns 400 for missing resourceId', async () => {
    const request = new Request('http://localhost/api/public/resource-click', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);

    const data = await response.json();
    expect(data.error).toBe('Invalid resourceId');
  });

  it('returns 400 for invalid resourceId', async () => {
    const request = new Request('http://localhost/api/public/resource-click', {
      method: 'POST',
      body: JSON.stringify({ resourceId: 'not-a-uuid' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('tracks click with valid resourceId', async () => {
    const resourceId = '550e8400-e29b-41d4-a716-446655440000';

    const request = new Request('http://localhost/api/public/resource-click', {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith({
      external_resource_id: resourceId,
      funnel_page_id: null,
      library_id: null,
    });
  });

  it('tracks click with funnelPageId and library lookup', async () => {
    const resourceId = '550e8400-e29b-41d4-a716-446655440000';
    const funnelPageId = '660e8400-e29b-41d4-a716-446655440001';
    const libraryId = '770e8400-e29b-41d4-a716-446655440002';

    mockSingle.mockResolvedValue({ data: { library_id: libraryId }, error: null });

    const request = new Request('http://localhost/api/public/resource-click', {
      method: 'POST',
      body: JSON.stringify({ resourceId, funnelPageId }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    expect(mockInsert).toHaveBeenCalledWith({
      external_resource_id: resourceId,
      funnel_page_id: funnelPageId,
      library_id: libraryId,
    });
  });

  it('returns success even if insert fails (analytics should not block)', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'DB error' } });

    const resourceId = '550e8400-e29b-41d4-a716-446655440000';

    const request = new Request('http://localhost/api/public/resource-click', {
      method: 'POST',
      body: JSON.stringify({ resourceId }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);

    const data = await response.json();
    expect(data.success).toBe(true);
  });
});
