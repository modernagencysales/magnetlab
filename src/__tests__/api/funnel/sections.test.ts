/**
 * @jest-environment node
 */

import { GET, POST } from '@/app/api/funnel/[id]/sections/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock team-context (routes now use getDataScope/applyScope for multi-team scoping)
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  applyScope: jest.fn((query: any, scope: any) => query.eq('user_id', scope.userId)),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

interface MockChainable {
  from: jest.Mock;
  select: jest.Mock;
  insert: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  single: jest.Mock;
}

function createMockSupabase() {
  let currentTable = '';
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};
  // Track order() call count per table to handle chained .order().order()
  const orderCallCount: Record<string, number> = {};

  const chainable: MockChainable = {
    from: jest.fn((table: string) => {
      currentTable = table;
      orderCallCount[table] = 0;
      return chainable;
    }),
    select: jest.fn(() => chainable),
    insert: jest.fn(() => chainable),
    eq: jest.fn(() => chainable),
    order: jest.fn(() => {
      orderCallCount[currentTable] = (orderCallCount[currentTable] || 0) + 1;
      // The sections route calls .order() twice (.order('page_location').order('sort_order'))
      // Return the result on the second call
      if (currentTable === 'funnel_page_sections' && orderCallCount[currentTable] >= 2 && tableResults[currentTable]) {
        return Promise.resolve(tableResults[currentTable]);
      }
      return chainable;
    }),
    limit: jest.fn(() => chainable),
    single: jest.fn(() => {
      return Promise.resolve(tableResults[currentTable] || { data: null, error: null });
    }),
  };

  return {
    chainable,
    setResult: (table: string, result: { data: unknown; error: unknown }) => {
      tableResults[table] = result;
    },
  };
}

describe('Sections API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/funnel/[id]/sections', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/funnel/f1/sections');
      const response = await GET(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(401);
    });

    it('should return 404 when funnel not found', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const mock = createMockSupabase();
      mock.setResult('funnel_pages', { data: null, error: { message: 'not found' } });
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.chainable);

      const request = new Request('http://localhost/api/funnel/f1/sections');
      const response = await GET(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(404);
    });

    it('should return sections when authenticated and funnel exists', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const mock = createMockSupabase();
      mock.setResult('funnel_pages', { data: { id: 'f1' }, error: null });
      mock.setResult('funnel_page_sections', {
        data: [
          {
            id: 's1',
            funnel_page_id: 'f1',
            section_type: 'testimonial',
            page_location: 'optin',
            sort_order: 10,
            is_visible: true,
            config: { quote: 'Great!' },
            created_at: '2026-01-29T00:00:00Z',
            updated_at: '2026-01-29T00:00:00Z',
          },
        ],
        error: null,
      });
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.chainable);

      const request = new Request('http://localhost/api/funnel/f1/sections');
      const response = await GET(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.sections).toHaveLength(1);
      expect(body.sections[0].sectionType).toBe('testimonial');
      expect(body.sections[0].config).toEqual({ quote: 'Great!' });
    });
  });

  describe('POST /api/funnel/[id]/sections', () => {
    it('should return 401 when unauthenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost/api/funnel/f1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'testimonial',
          pageLocation: 'optin',
          config: { quote: 'Test' },
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid section type', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const mock = createMockSupabase();
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.chainable);

      const request = new Request('http://localhost/api/funnel/f1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'invalid',
          pageLocation: 'optin',
          config: {},
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(400);
    });

    it('should return 400 for invalid page location', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      const mock = createMockSupabase();
      (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.chainable);

      const request = new Request('http://localhost/api/funnel/f1/sections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sectionType: 'testimonial',
          pageLocation: 'bogus',
          config: { quote: 'Test' },
        }),
      });
      const response = await POST(request, { params: Promise.resolve({ id: 'f1' }) });

      expect(response.status).toBe(400);
    });
  });
});
