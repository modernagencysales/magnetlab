/**
 * @jest-environment node
 */

import { GET } from '@/app/api/analytics/overview/route';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client that supports both chaining and awaiting.
 * Each from() call creates an independent chain that captures its own table context.
 * Every chain method returns a thenable that is also chainable — just like the real
 * Supabase PostgREST builder.
 */
function createMockSupabase() {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};

  function createChain(table: string) {
    const resolve = () => Promise.resolve(tableResults[table] || { data: [], error: null });

    // Create a thenable object with chain methods
    const chain: Record<string, unknown> = {
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    // Chain methods: return the same thenable/chainable object
    for (const method of ['select', 'eq', 'in', 'gte', 'order']) {
      chain[method] = jest.fn(() => chain);
    }

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    setResult: (table: string, result: { data: unknown; error: unknown }) => {
      tableResults[table] = result;
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

describe('GET /api/analytics/overview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should return 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new Request('http://localhost:3000/api/analytics/overview');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 400 for invalid range param', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=999d');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should default to 30d range when no range param', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const request = new Request('http://localhost:3000/api/analytics/overview');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    // Default 30d should produce 30 entries
    expect(data.viewsByDay).toHaveLength(30);
    expect(data.leadsByDay).toHaveLength(30);
  });

  it('should return zeros/empty arrays when user has no funnels', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.viewsByDay).toHaveLength(7);
    expect(data.leadsByDay).toHaveLength(7);
    expect(data.utmBreakdown).toEqual([]);
    expect(data.totals).toEqual({
      views: 0,
      leads: 0,
      qualified: 0,
      conversionRate: 0,
      qualificationRate: 0,
    });

    // All days should have zero values
    data.viewsByDay.forEach((entry: { date: string; views: number }) => {
      expect(entry.views).toBe(0);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
    data.leadsByDay.forEach((entry: { date: string; leads: number }) => {
      expect(entry.leads).toBe(0);
      expect(entry.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('should accept 7d range and return 7 days', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.viewsByDay).toHaveLength(7);
    expect(data.leadsByDay).toHaveLength(7);
  });

  it('should accept 90d range and return 90 days', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=90d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.viewsByDay).toHaveLength(90);
    expect(data.leadsByDay).toHaveLength(90);
  });

  it('should aggregate views and leads by day', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1' }],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: todayStr },
        { funnel_page_id: 'funnel-1', view_date: todayStr },
        { funnel_page_id: 'funnel-1', view_date: yesterdayStr },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        {
          funnel_page_id: 'funnel-1',
          is_qualified: true,
          utm_source: 'linkedin',
          created_at: `${todayStr}T10:00:00Z`,
        },
        {
          funnel_page_id: 'funnel-1',
          is_qualified: false,
          utm_source: 'google',
          created_at: `${yesterdayStr}T15:00:00Z`,
        },
      ],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Check today's views
    const todayViews = data.viewsByDay.find((d: { date: string }) => d.date === todayStr);
    expect(todayViews?.views).toBe(2);

    // Check yesterday's views
    const yesterdayViews = data.viewsByDay.find((d: { date: string }) => d.date === yesterdayStr);
    expect(yesterdayViews?.views).toBe(1);

    // Check today's leads
    const todayLeads = data.leadsByDay.find((d: { date: string }) => d.date === todayStr);
    expect(todayLeads?.leads).toBe(1);

    // Check yesterday's leads
    const yesterdayLeads = data.leadsByDay.find((d: { date: string }) => d.date === yesterdayStr);
    expect(yesterdayLeads?.leads).toBe(1);

    // Check totals
    expect(data.totals.views).toBe(3);
    expect(data.totals.leads).toBe(2);
    expect(data.totals.qualified).toBe(1);
    // conversionRate = Math.round((2/3)*100) = 67
    expect(data.totals.conversionRate).toBe(67);
    // qualificationRate = Math.round((1/2)*100) = 50
    expect(data.totals.qualificationRate).toBe(50);
  });

  it('should return UTM breakdown sorted by count desc', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1' }],
      error: null,
    });
    mock.setResult('page_views', {
      data: [],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', is_qualified: false, utm_source: 'google', created_at: `${today}T10:00:00Z` },
        { funnel_page_id: 'funnel-1', is_qualified: false, utm_source: 'linkedin', created_at: `${today}T11:00:00Z` },
        { funnel_page_id: 'funnel-1', is_qualified: true, utm_source: 'linkedin', created_at: `${today}T12:00:00Z` },
        { funnel_page_id: 'funnel-1', is_qualified: false, utm_source: 'linkedin', created_at: `${today}T13:00:00Z` },
        { funnel_page_id: 'funnel-1', is_qualified: false, utm_source: null, created_at: `${today}T14:00:00Z` },
      ],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.utmBreakdown).toHaveLength(3);
    // linkedin=3, google=1, direct=1
    expect(data.utmBreakdown[0]).toEqual({ source: 'linkedin', count: 3 });
    expect(data.utmBreakdown[1]).toEqual({ source: 'google', count: 1 });
    expect(data.utmBreakdown[2]).toEqual({ source: 'direct', count: 1 });
  });

  it('should handle database errors gracefully', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', {
      data: null,
      error: { message: 'DB connection failed', code: '500' },
    });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(500);
  });

  it('should handle conversionRate as 0 when views is 0', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1' }],
      error: null,
    });
    mock.setResult('page_views', {
      data: [],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', is_qualified: true, utm_source: null, created_at: `${today}T10:00:00Z` },
      ],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals.views).toBe(0);
    expect(data.totals.leads).toBe(1);
    expect(data.totals.conversionRate).toBe(0);
    expect(data.totals.qualificationRate).toBe(100);
  });

  it('should handle qualificationRate as 0 when leads is 0', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1' }],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: new Date().toISOString().split('T')[0] },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals.views).toBe(1);
    expect(data.totals.leads).toBe(0);
    expect(data.totals.qualified).toBe(0);
    expect(data.totals.conversionRate).toBe(0);
    expect(data.totals.qualificationRate).toBe(0);
  });

  it('should aggregate across multiple funnels', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1' }, { id: 'funnel-2' }],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-2', view_date: today },
        { funnel_page_id: 'funnel-2', view_date: today },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', is_qualified: true, utm_source: 'linkedin', created_at: `${today}T10:00:00Z` },
        { funnel_page_id: 'funnel-2', is_qualified: false, utm_source: 'linkedin', created_at: `${today}T11:00:00Z` },
      ],
      error: null,
    });

    const request = new Request('http://localhost:3000/api/analytics/overview?range=7d');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();

    // Views from both funnels
    const todayViews = data.viewsByDay.find((d: { date: string }) => d.date === today);
    expect(todayViews?.views).toBe(3);

    // Leads from both funnels
    const todayLeads = data.leadsByDay.find((d: { date: string }) => d.date === today);
    expect(todayLeads?.leads).toBe(2);

    expect(data.totals.views).toBe(3);
    expect(data.totals.leads).toBe(2);
    expect(data.totals.qualified).toBe(1);
  });
});
