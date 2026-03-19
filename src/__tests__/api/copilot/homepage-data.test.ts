/**
 * @jest-environment node
 */
import { GET } from '@/app/api/copilot/homepage-data/route';
import { NextRequest } from 'next/server';

// ─── Mock auth ────────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

// ─── Mock team-context ────────────────────────────────────────────────────────

const mockGetDataScope = jest.fn();
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: (...args: unknown[]) => mockGetDataScope(...args),
  applyScope: jest.fn((query: unknown) => query),
}));

// ─── Mock briefing service ───────────────────────────────────────────────────

const mockFetchBriefingData = jest.fn();
jest.mock('@/server/services/copilot-briefing.service', () => ({
  fetchBriefingData: (...args: unknown[]) => mockFetchBriefingData(...args),
}));

// ─── Mock logger ──────────────────────────────────────────────────────────────

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Supabase mock ────────────────────────────────────────────────────────────

/**
 * Builds a chainable Supabase query mock.
 * The `then` property makes it thenable so `await query` resolves directly.
 */
function makeChain(resolved: { data: unknown; count?: number | null; error: unknown }) {
  const chain: Record<string, jest.Mock> = {};
  const methods = ['from', 'select', 'eq', 'in', 'gte', 'lt', 'order', 'limit', 'single'];

  for (const method of methods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }

  (chain as Record<string, unknown>).then = (
    resolve: (val: { data: unknown; count?: number | null; error: unknown }) => void
  ) => Promise.resolve(resolved).then(resolve);

  return chain;
}

// Chains for different tables
const postsThisWeekChain = makeChain({ data: null, count: 24, error: null });
const postsLastWeekChain = makeChain({ data: null, count: 21, error: null });
const funnelPagesChain = makeChain({
  data: [{ id: 'fp-1' }, { id: 'fp-2' }],
  count: 2,
  error: null,
});
const viewsThisWeekChain = makeChain({ data: null, count: 847, error: null });
const viewsLastWeekChain = makeChain({ data: null, count: 891, error: null });
const conversationsChain = makeChain({
  data: [
    { id: 'conv-1', title: 'Draft LinkedIn posts', updated_at: '2026-03-19T12:00:00Z' },
    { id: 'conv-2', title: 'Analyze leads', updated_at: '2026-03-18T09:00:00Z' },
  ],
  error: null,
});
const defaultChain = makeChain({ data: null, count: 0, error: null });

const mockFrom = jest.fn();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const DEFAULT_BRIEFING = {
  queueCount: 3,
  scheduledThisWeek: 2,
  autopilotStatus: 'running' as const,
  ideasRemaining: 15,
  nextScheduledPost: '2026-03-20T10:00:00Z',
  newLeadsCount: 12,
  newLeadsBySource: [{ source: 'GTM Guide', count: 12 }],
  activeCampaigns: { postCampaigns: 1, outreachSequences: 0 },
  magnetCount: 5,
  publishedMagnetCount: 2,
};

const DEFAULT_SCOPE = { type: 'user' as const, userId: 'user-1' };

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  jest.clearAllMocks();

  mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
  mockGetDataScope.mockResolvedValue(DEFAULT_SCOPE);
  mockFetchBriefingData.mockResolvedValue(DEFAULT_BRIEFING);

  // Route the from() calls to appropriate chains
  mockFrom.mockImplementation((table: string) => {
    if (table === 'cp_pipeline_posts') {
      // First call = this week, second = last week (or by call order)
      return postsThisWeekChain;
    }
    if (table === 'funnel_pages') return funnelPagesChain;
    if (table === 'page_views') return viewsThisWeekChain;
    if (table === 'copilot_conversations') return conversationsChain;
    return defaultChain;
  });

  // Rewire chain methods after clearAllMocks
  for (const chain of [
    postsThisWeekChain,
    postsLastWeekChain,
    funnelPagesChain,
    viewsThisWeekChain,
    viewsLastWeekChain,
    conversationsChain,
    defaultChain,
  ]) {
    for (const method of ['from', 'select', 'eq', 'in', 'gte', 'lt', 'order', 'limit', 'single']) {
      (chain as Record<string, jest.Mock>)[method].mockReturnValue(chain);
    }
  }
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/copilot/homepage-data', () => {
  function makeRequest() {
    return new NextRequest('http://localhost/api/copilot/homepage-data', { method: 'GET' });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValueOnce(null);

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);

    const body = await res.json();
    expect(body).toEqual({ error: 'Unauthorized' });
  });

  it('returns 401 when session has no user id', async () => {
    mockAuth.mockResolvedValueOnce({ user: {} });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  // ── Response shape ────────────────────────────────────────────────────────

  it('returns 200 with suggestions, stats, and recentConversations', async () => {
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty('suggestions');
    expect(body).toHaveProperty('stats');
    expect(body).toHaveProperty('recentConversations');
  });

  it('suggestions are sorted by priority ascending', async () => {
    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    expect(Array.isArray(suggestions)).toBe(true);
    expect(suggestions.length).toBeGreaterThan(0);

    for (let i = 1; i < suggestions.length; i++) {
      expect(suggestions[i].priority).toBeGreaterThanOrEqual(suggestions[i - 1].priority);
    }
  });

  it('suggestion for queue count is included when queueCount > 0', async () => {
    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const queueSuggestion = suggestions.find((s: { action: string }) =>
      s.action.toLowerCase().includes('content queue')
    );
    expect(queueSuggestion).toBeDefined();
    expect(queueSuggestion.label).toContain('3');
    expect(queueSuggestion.priority).toBe(1);
  });

  it('suggestion for new leads is included when newLeadsCount > 0', async () => {
    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const leadsSuggestion = suggestions.find((s: { action: string }) =>
      s.action.toLowerCase().includes('leads')
    );
    expect(leadsSuggestion).toBeDefined();
    expect(leadsSuggestion.label).toContain('12');
    expect(leadsSuggestion.priority).toBe(2);
  });

  it('includes autopilot running suggestion when autopilotStatus is running', async () => {
    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const autopilotSuggestion = suggestions.find((s: { label: string }) =>
      s.label.toLowerCase().includes('autopilot')
    );
    expect(autopilotSuggestion).toBeDefined();
    expect(autopilotSuggestion.label).toContain('running');
  });

  it('includes fallback create lead magnet suggestion', async () => {
    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const fallback = suggestions.find((s: { priority: number }) => s.priority === 10);
    expect(fallback).toBeDefined();
    expect(fallback.action).toContain('lead magnet');
  });

  it('returns at most 6 suggestions', async () => {
    const res = await GET(makeRequest());
    const { suggestions } = await res.json();
    expect(suggestions.length).toBeLessThanOrEqual(6);
  });

  // ── Stats shape ───────────────────────────────────────────────────────────

  it('stats contain the required keys', async () => {
    const res = await GET(makeRequest());
    const { stats } = await res.json();

    expect(Array.isArray(stats)).toBe(true);
    const keys = stats.map((s: { key: string }) => s.key);
    expect(keys).toContain('posts');
    expect(keys).toContain('views');
    expect(keys).toContain('leads');
    expect(keys).toContain('magnets');
  });

  it('each stat has label, value, and changeType fields', async () => {
    const res = await GET(makeRequest());
    const { stats } = await res.json();

    for (const stat of stats) {
      expect(stat).toHaveProperty('key');
      expect(stat).toHaveProperty('label');
      expect(stat).toHaveProperty('value');
      expect(stat).toHaveProperty('changeType');
    }
  });

  it('magnets stat uses magnetCount from briefing data', async () => {
    const res = await GET(makeRequest());
    const { stats } = await res.json();

    const magnetStat = stats.find((s: { key: string }) => s.key === 'magnets');
    expect(magnetStat.value).toBe(5);
    expect(magnetStat.sublabel).toContain('2');
  });

  // ── Recent conversations ──────────────────────────────────────────────────

  it('recentConversations maps to id/title/updatedAt shape', async () => {
    const res = await GET(makeRequest());
    const { recentConversations } = await res.json();

    expect(Array.isArray(recentConversations)).toBe(true);
    expect(recentConversations.length).toBeGreaterThan(0);

    const first = recentConversations[0];
    expect(first).toHaveProperty('id');
    expect(first).toHaveProperty('title');
    expect(first).toHaveProperty('updatedAt');
    expect(first).not.toHaveProperty('updated_at');
  });

  it('recentConversations are scoped to the authenticated user', async () => {
    await GET(makeRequest());

    expect(mockFrom).toHaveBeenCalledWith('copilot_conversations');
    // The eq('user_id', ...) call should exist on the conversations chain
    expect(conversationsChain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  // ── No suggestions for empty state ───────────────────────────────────────

  it('omits queue suggestion when queueCount is 0', async () => {
    mockFetchBriefingData.mockResolvedValueOnce({
      ...DEFAULT_BRIEFING,
      queueCount: 0,
    });

    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const queueSuggestion = suggestions.find((s: { priority: number }) => s.priority === 1);
    expect(queueSuggestion).toBeUndefined();
  });

  it('omits leads suggestion when newLeadsCount is 0', async () => {
    mockFetchBriefingData.mockResolvedValueOnce({
      ...DEFAULT_BRIEFING,
      newLeadsCount: 0,
    });

    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const leadsSuggestion = suggestions.find((s: { priority: number }) => s.priority === 2);
    expect(leadsSuggestion).toBeUndefined();
  });

  // ── Autopilot status variants ─────────────────────────────────────────────

  it('shows paused label when autopilotStatus is paused', async () => {
    mockFetchBriefingData.mockResolvedValueOnce({
      ...DEFAULT_BRIEFING,
      autopilotStatus: 'paused' as const,
    });

    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const autopilot = suggestions.find((s: { label: string }) =>
      s.label.toLowerCase().includes('autopilot')
    );
    expect(autopilot?.label).toContain('paused');
  });

  it('shows no ideas label when autopilotStatus is no_ideas', async () => {
    mockFetchBriefingData.mockResolvedValueOnce({
      ...DEFAULT_BRIEFING,
      autopilotStatus: 'no_ideas' as const,
    });

    const res = await GET(makeRequest());
    const { suggestions } = await res.json();

    const autopilot = suggestions.find((s: { label: string }) =>
      s.label.toLowerCase().includes('ideas')
    );
    expect(autopilot).toBeDefined();
  });
});
