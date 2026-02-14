/**
 * @jest-environment node
 */

import { GET } from '@/app/api/analytics/funnel/[id]/route';
import { NextRequest } from 'next/server';

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
 * The single() method resolves to { data: <first element or null>, error: null }
 * unless a specific single-mode result is configured.
 */
function createMockSupabase() {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};
  // Separate results for .single() calls (returns object, not array)
  const singleResults: Record<string, { data: unknown; error: unknown }> = {};

  function createChain(table: string) {
    let useSingle = false;

    const resolve = () => {
      if (useSingle) {
        if (singleResults[table]) {
          return Promise.resolve(singleResults[table]);
        }
        // Default single behavior: return first element or PGRST116 error
        const result = tableResults[table] || { data: [], error: null };
        const arr = Array.isArray(result.data) ? result.data : [];
        if (arr.length === 0) {
          return Promise.resolve({
            data: null,
            error: { message: 'Row not found', code: 'PGRST116' },
          });
        }
        return Promise.resolve({ data: arr[0], error: null });
      }
      return Promise.resolve(tableResults[table] || { data: [], error: null });
    };

    const chain: Record<string, unknown> = {
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    // Chain methods: return the same thenable/chainable object
    for (const method of ['select', 'eq', 'in', 'gte', 'order']) {
      chain[method] = jest.fn(() => chain);
    }

    // single() sets the flag and returns the chain
    chain['single'] = jest.fn(() => {
      useSingle = true;
      return chain;
    });

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
    setSingleResult: (table: string, result: { data: unknown; error: unknown }) => {
      singleResults[table] = result;
    },
  };
}

/** Helper to build the params Promise that Next.js 15 dynamic routes use */
function makeParams(id: string): Promise<{ id: string }> {
  return Promise.resolve({ id });
}

let mock: ReturnType<typeof createMockSupabase>;

describe('GET /api/analytics/funnel/[id]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should return 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.code).toBe('UNAUTHORIZED');
  });

  it('should return 403 when funnel is not owned by user', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    // Simulate no matching row (funnel belongs to another user or does not exist)
    mock.setSingleResult('funnel_pages', {
      data: null,
      error: { message: 'Row not found', code: 'PGRST116' },
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-other');
    const response = await GET(request, { params: makeParams('funnel-other') });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.code).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid range param', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=999d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('should default to 30d range and return correct time-series structure', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'My Funnel', slug: 'my-funnel' },
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Default 30d should produce 30 entries
    expect(data.viewsByDay).toHaveLength(30);
    expect(data.leadsByDay).toHaveLength(30);
    expect(data.funnel).toEqual({ id: 'funnel-1', title: 'My Funnel', slug: 'my-funnel' });
    expect(data.leads).toEqual([]);
    expect(data.totals).toEqual({
      views: 0,
      leads: 0,
      qualified: 0,
      conversionRate: 0,
      qualificationRate: 0,
    });
  });

  it('should accept 7d range and return 7 days', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'My Funnel', slug: 'my-funnel' },
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.viewsByDay).toHaveLength(7);
    expect(data.leadsByDay).toHaveLength(7);
  });

  it('should accept 90d range and return 90 days', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'My Funnel', slug: 'my-funnel' },
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=90d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.viewsByDay).toHaveLength(90);
    expect(data.leadsByDay).toHaveLength(90);
  });

  it('should return correct time-series views, leads, and lead table', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'Test Funnel', slug: 'test-funnel' },
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { view_date: todayStr },
        { view_date: todayStr },
        { view_date: yesterdayStr },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        {
          id: 'lead-1',
          email: 'alice@example.com',
          name: 'Alice',
          is_qualified: true,
          utm_source: 'linkedin',
          created_at: `${todayStr}T10:00:00Z`,
        },
        {
          id: 'lead-2',
          email: 'bob@example.com',
          name: null,
          is_qualified: false,
          utm_source: 'google',
          created_at: `${yesterdayStr}T15:00:00Z`,
        },
      ],
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();

    // Funnel metadata
    expect(data.funnel).toEqual({ id: 'funnel-1', title: 'Test Funnel', slug: 'test-funnel' });

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

    // Check lead table
    expect(data.leads).toHaveLength(2);
    expect(data.leads[0]).toEqual({
      id: 'lead-1',
      email: 'alice@example.com',
      name: 'Alice',
      isQualified: true,
      utmSource: 'linkedin',
      createdAt: `${todayStr}T10:00:00Z`,
    });
    expect(data.leads[1]).toEqual({
      id: 'lead-2',
      email: 'bob@example.com',
      name: null,
      isQualified: false,
      utmSource: 'google',
      createdAt: `${yesterdayStr}T15:00:00Z`,
    });

    // Check totals
    expect(data.totals.views).toBe(3);
    expect(data.totals.leads).toBe(2);
    expect(data.totals.qualified).toBe(1);
    // conversionRate = Math.round((2/3)*100) = 67
    expect(data.totals.conversionRate).toBe(67);
    // qualificationRate = Math.round((1/2)*100) = 50
    expect(data.totals.qualificationRate).toBe(50);
  });

  it('should return zero-filled time-series when funnel has no data', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'Empty Funnel', slug: 'empty-funnel' },
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.viewsByDay).toHaveLength(7);
    expect(data.leadsByDay).toHaveLength(7);
    expect(data.leads).toEqual([]);
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

  it('should handle conversionRate as 0 when views is 0', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'No Views', slug: 'no-views' },
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });
    mock.setResult('funnel_leads', {
      data: [
        { id: 'lead-1', email: 'a@b.com', name: null, is_qualified: true, utm_source: null, created_at: `${today}T10:00:00Z` },
      ],
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals.views).toBe(0);
    expect(data.totals.leads).toBe(1);
    expect(data.totals.conversionRate).toBe(0);
    expect(data.totals.qualificationRate).toBe(100);
  });

  it('should handle qualificationRate as 0 when leads is 0', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'No Leads', slug: 'no-leads' },
      error: null,
    });
    mock.setResult('page_views', {
      data: [{ view_date: new Date().toISOString().split('T')[0] }],
      error: null,
    });
    mock.setResult('funnel_leads', { data: [], error: null });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.totals.views).toBe(1);
    expect(data.totals.leads).toBe(0);
    expect(data.totals.qualified).toBe(0);
    expect(data.totals.conversionRate).toBe(0);
    expect(data.totals.qualificationRate).toBe(0);
  });

  it('should handle database errors gracefully', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setSingleResult('funnel_pages', {
      data: null,
      error: { message: 'DB connection failed', code: '500' },
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    // DB error with non-PGRST116 code should return 500
    expect(response.status).toBe(500);
  });

  it('should map lead fields to camelCase in the leads table', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setSingleResult('funnel_pages', {
      data: { id: 'funnel-1', title: 'Funnel', slug: 'funnel' },
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });
    mock.setResult('funnel_leads', {
      data: [
        {
          id: 'lead-1',
          email: 'test@example.com',
          name: 'Test User',
          is_qualified: null,
          utm_source: 'twitter',
          created_at: `${today}T08:30:00Z`,
        },
      ],
      error: null,
    });

    const request = new NextRequest('http://localhost:3000/api/analytics/funnel/funnel-1?range=7d');
    const response = await GET(request, { params: makeParams('funnel-1') });

    expect(response.status).toBe(200);
    const data = await response.json();

    expect(data.leads[0]).toEqual({
      id: 'lead-1',
      email: 'test@example.com',
      name: 'Test User',
      isQualified: null,
      utmSource: 'twitter',
      createdAt: `${today}T08:30:00Z`,
    });
  });
});
