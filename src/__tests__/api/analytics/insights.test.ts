/**
 * @jest-environment node
 *
 * Tests for:
 *   GET /api/analytics/performance-insights
 *   GET /api/analytics/recommendations
 */

import { GET as getInsights } from '@/app/api/analytics/performance-insights/route';
import { GET as getRecommendations } from '@/app/api/analytics/recommendations/route';

// ─── Mocks ─────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({ auth: jest.fn() }));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn((userId: string) => Promise.resolve({ type: 'user', userId })),
  applyScope: jest.fn((query: unknown, scope: { userId: string }) =>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (query as any).eq('user_id', scope.userId)
  ),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock Supabase Factory ──────────────────────────────────────────────────

/**
 * Creates a mock Supabase client where each table call returns an independent
 * thenable chain. Results are registered per-table via setResult().
 */
function createMockSupabase() {
  const tableResults: Record<string, { data: unknown; error: unknown }> = {};

  function createChain(table: string) {
    const resolve = () => {
      const result = tableResults[table] || { data: [], error: null };
      return Promise.resolve(result);
    };

    const chain: Record<string, unknown> = {
      then: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => resolve().then(onFulfilled, onRejected),
    };

    for (const method of ['select', 'eq', 'in', 'gte', 'order', 'limit', 'neq']) {
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

// ─── Shared setup ──────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();
  mock = createMockSupabase();
  (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
});

// ─── performance-insights ──────────────────────────────────────────────────

describe('GET /api/analytics/performance-insights', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid period param', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const req = new Request(
      'http://localhost/api/analytics/performance-insights?period=last_2_years'
    );
    const res = await getInsights(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns zeros when user has no funnels', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.top_archetypes).toEqual([]);
    expect(body.top_lead_magnets).toEqual([]);
    expect(body.totals.total_leads).toBe(0);
    expect(body.totals.total_views).toBe(0);
    expect(body.totals.avg_conversion_rate).toBe(0);
    expect(body.period).toBe('last_30_days');
  });

  it('accepts explicit period param', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const req = new Request(
      'http://localhost/api/analytics/performance-insights?period=last_7_days'
    );
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('last_7_days');
  });

  it('returns top_archetypes sorted by leads desc', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    // Two funnels: funnel-1 → lead-magnet-1 (single-breakdown), funnel-2 → lead-magnet-2 (focused-toolkit)
    mock.setResult('funnel_pages', {
      data: [
        { id: 'funnel-1', lead_magnet_id: 'lm-1' },
        { id: 'funnel-2', lead_magnet_id: 'lm-2' },
      ],
      error: null,
    });
    mock.setResult('lead_magnets', {
      data: [
        { id: 'lm-1', title: 'Cold Email Breakdown', archetype: 'single-breakdown' },
        { id: 'lm-2', title: 'Toolkit', archetype: 'focused-toolkit' },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', created_at: `${today}T10:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T11:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T12:00:00Z` },
        { funnel_page_id: 'funnel-2', created_at: `${today}T13:00:00Z` },
      ],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-2', view_date: today },
        { funnel_page_id: 'funnel-2', view_date: today },
      ],
      error: null,
    });

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    // single-breakdown: 3 leads, focused-toolkit: 1 lead → sorted desc
    expect(body.top_archetypes).toHaveLength(2);
    expect(body.top_archetypes[0].archetype).toBe('single-breakdown');
    expect(body.top_archetypes[0].leads).toBe(3);
    // conversion_rate: 3 leads / 4 views * 100 = 75
    expect(body.top_archetypes[0].conversion_rate).toBe(75);
    expect(body.top_archetypes[1].archetype).toBe('focused-toolkit');
    expect(body.top_archetypes[1].leads).toBe(1);
  });

  it('returns top_lead_magnets sorted by leads desc', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [
        { id: 'funnel-1', lead_magnet_id: 'lm-1' },
        { id: 'funnel-2', lead_magnet_id: 'lm-2' },
      ],
      error: null,
    });
    mock.setResult('lead_magnets', {
      data: [
        { id: 'lm-1', title: 'Top Magnet', archetype: 'single-breakdown' },
        { id: 'lm-2', title: 'Low Magnet', archetype: 'focused-toolkit' },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', created_at: `${today}T10:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T11:00:00Z` },
      ],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
      ],
      error: null,
    });

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.top_lead_magnets.length).toBeGreaterThanOrEqual(1);
    const topMagnet = body.top_lead_magnets[0];
    expect(topMagnet.id).toBe('lm-1');
    expect(topMagnet.title).toBe('Top Magnet');
    expect(topMagnet.leads).toBe(2);
    expect(topMagnet.views).toBe(3);
  });

  it('computes correct totals', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1', lead_magnet_id: 'lm-1' }],
      error: null,
    });
    mock.setResult('lead_magnets', {
      data: [{ id: 'lm-1', title: 'Magnet', archetype: 'single-breakdown' }],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', created_at: `${today}T10:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T11:00:00Z` },
      ],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
      ],
      error: null,
    });

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totals.total_leads).toBe(2);
    expect(body.totals.total_views).toBe(4);
    // avg_conversion_rate: round(2/4 * 100) = 50
    expect(body.totals.avg_conversion_rate).toBe(50);
  });

  it('handles 0 views without division error', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('funnel_pages', {
      data: [{ id: 'funnel-1', lead_magnet_id: 'lm-1' }],
      error: null,
    });
    mock.setResult('lead_magnets', {
      data: [{ id: 'lm-1', title: 'Magnet', archetype: 'single-breakdown' }],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [{ funnel_page_id: 'funnel-1', created_at: `${today}T10:00:00Z` }],
      error: null,
    });
    mock.setResult('page_views', { data: [], error: null });

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.avg_conversion_rate).toBe(0);
  });

  it('returns 500 on database error', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', {
      data: null,
      error: { message: 'DB error', code: '500' },
    });

    const req = new Request('http://localhost/api/analytics/performance-insights');
    const res = await getInsights(req);

    expect(res.status).toBe(500);
  });

  it('accepts all_time period', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('funnel_pages', { data: [], error: null });

    const req = new Request('http://localhost/api/analytics/performance-insights?period=all_time');
    const res = await getInsights(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.period).toBe('all_time');
  });
});

// ─── recommendations ──────────────────────────────────────────────────────

describe('GET /api/analytics/recommendations', () => {
  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const req = new Request('http://localhost/api/analytics/recommendations');
    const res = await getRecommendations(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns phase stub structure', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('cp_knowledge_topics', { data: [], error: null });
    mock.setResult('funnel_pages', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const req = new Request('http://localhost/api/analytics/recommendations');
    const res = await getRecommendations(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.phase).toBe('stub');
    expect(typeof body.note).toBe('string');
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it('includes content_gap suggestion when user has topics but no lead magnets', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    mock.setResult('cp_knowledge_topics', {
      data: [
        { slug: 'cold-email', display_name: 'Cold Email', entry_count: 5 },
        { slug: 'linkedin-outreach', display_name: 'LinkedIn Outreach', entry_count: 3 },
      ],
      error: null,
    });
    mock.setResult('funnel_pages', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const req = new Request('http://localhost/api/analytics/recommendations');
    const res = await getRecommendations(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    const contentGaps = body.suggestions.filter((s: { type: string }) => s.type === 'content_gap');
    expect(contentGaps.length).toBeGreaterThan(0);
    expect(typeof contentGaps[0].message).toBe('string');
  });

  it('includes performance suggestion when one archetype clearly outperforms', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const today = new Date().toISOString().split('T')[0];

    mock.setResult('cp_knowledge_topics', { data: [], error: null });
    mock.setResult('funnel_pages', {
      data: [
        { id: 'funnel-1', lead_magnet_id: 'lm-1' },
        { id: 'funnel-2', lead_magnet_id: 'lm-2' },
      ],
      error: null,
    });
    mock.setResult('lead_magnets', {
      data: [
        { id: 'lm-1', title: 'Breakdown', archetype: 'single-breakdown' },
        { id: 'lm-2', title: 'Toolkit', archetype: 'focused-toolkit' },
      ],
      error: null,
    });
    mock.setResult('funnel_leads', {
      data: [
        { funnel_page_id: 'funnel-1', created_at: `${today}T10:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T11:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T12:00:00Z` },
        { funnel_page_id: 'funnel-1', created_at: `${today}T13:00:00Z` },
        // funnel-2 has 0 leads
      ],
      error: null,
    });
    mock.setResult('page_views', {
      data: [
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-1', view_date: today },
        { funnel_page_id: 'funnel-2', view_date: today },
        { funnel_page_id: 'funnel-2', view_date: today },
      ],
      error: null,
    });

    const req = new Request('http://localhost/api/analytics/recommendations');
    const res = await getRecommendations(req);

    expect(res.status).toBe(200);
    const body = await res.json();

    const perfSuggestions = body.suggestions.filter(
      (s: { type: string }) => s.type === 'performance'
    );
    expect(perfSuggestions.length).toBeGreaterThan(0);
    expect(typeof perfSuggestions[0].message).toBe('string');
  });

  it('returns empty suggestions when user has no data', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('cp_knowledge_topics', { data: [], error: null });
    mock.setResult('funnel_pages', { data: [], error: null });
    mock.setResult('funnel_leads', { data: [], error: null });

    const req = new Request('http://localhost/api/analytics/recommendations');
    const res = await getRecommendations(req);

    expect(res.status).toBe(200);
    const body = await res.json();
    // No data → no actionable suggestions (still valid, just empty)
    expect(Array.isArray(body.suggestions)).toBe(true);
  });

  it('returns 500 on database error', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setResult('cp_knowledge_topics', {
      data: null,
      error: { message: 'DB error', code: '500' },
    });
    mock.setResult('funnel_pages', {
      data: null,
      error: { message: 'DB error', code: '500' },
    });

    const req = new Request('http://localhost/api/analytics/recommendations');
    const res = await getRecommendations(req);

    expect(res.status).toBe(500);
  });
});
