/**
 * @jest-environment node
 */

// ─── Mock external deps (before imports) ────────────────────────────────────

const mockSupabaseClient = {
  from: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// applyScope is a pure function — mock the module to avoid next/headers import side effects.
jest.mock('@/lib/utils/team-context', () => ({
  applyScope: jest.fn(
    (
      query: Record<string, jest.Mock>,
      scope: { type: string; userId: string; teamId?: string }
    ) => {
      if (scope.type === 'team' && scope.teamId) {
        return query.eq('team_id', scope.teamId);
      }
      return query.eq('user_id', scope.userId);
    }
  ),
}));

// ─── Import after mocks ──────────────────────────────────────────────────────

import {
  fetchBriefingData,
  formatBriefingPrompt,
  type BriefingData,
} from '@/server/services/copilot-briefing.service';
import { applyScope as mockApplyScope } from '@/lib/utils/team-context';
import type { DataScope } from '@/lib/utils/team-context';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Fluent Supabase chain mock. Each method returns the chain itself.
 * `then` makes the chain await-able.
 */
function buildChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, jest.Mock> = {};

  const resolve = () => Promise.resolve(result);

  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.neq = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.lt = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.single = jest.fn(resolve);
  chain.maybeSingle = jest.fn(resolve);

  Object.defineProperty(chain, 'then', {
    value: (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    enumerable: false,
  });

  return chain;
}

// ─── Test data ───────────────────────────────────────────────────────────────

const USER_SCOPE: DataScope = { type: 'user', userId: 'user-test-123' };
const TEAM_SCOPE: DataScope = { type: 'team', userId: 'user-test-123', teamId: 'team-test-456' };

const NOW = new Date('2026-03-19T12:00:00Z');

/**
 * Build a full set of mocks in the order fetchBriefingData calls them.
 *
 * Execution order:
 *   Parallel Promise.all (calls 0–7):
 *     0. cp_pipeline_posts (queue count)
 *     1. cp_pipeline_posts (scheduled this week)
 *     2. cp_content_ideas (ideas count)
 *     3. funnel_leads (new leads)
 *     4. post_campaigns (active count)
 *     5. outreach_campaigns (active count)
 *     6. lead_magnets (total count)
 *     7. lead_magnets (published count)
 *   Sequential (call 8, only when leads.length > 0):
 *     8. lead_magnets (title lookup for source grouping)
 */
function mockAllQueries(
  overrides: {
    queueCount?: number;
    scheduledData?: { scheduled_time: string }[];
    ideasCount?: number;
    leadsData?: { lead_magnet_id: string }[];
    leadMagnetsData?: { id: string; title: string }[];
    postCampaignsCount?: number;
    outreachCount?: number;
    magnetTotal?: number;
    magnetPublishedCount?: number;
  } = {}
) {
  // 0. queueCount: cp_pipeline_posts where status = 'reviewing'
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: null, error: null, count: overrides.queueCount ?? 3 })
  );

  // 1. scheduledThisWeek + nextScheduledPost: cp_pipeline_posts where status='scheduled' this week
  const scheduledData = overrides.scheduledData ?? [
    { scheduled_time: new Date(NOW.getTime() + 24 * 60 * 60 * 1000).toISOString() },
    { scheduled_time: new Date(NOW.getTime() + 48 * 60 * 60 * 1000).toISOString() },
  ];
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: scheduledData, error: null, count: scheduledData.length })
  );

  // 2. ideasRemaining: cp_content_ideas where status in ['new', 'approved', 'extracted', 'selected']
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: null, error: null, count: overrides.ideasCount ?? 12 })
  );

  // 3. funnel_leads: new leads in last 7 days
  const leadsData = overrides.leadsData ?? [
    { lead_magnet_id: 'magnet-1' },
    { lead_magnet_id: 'magnet-1' },
    { lead_magnet_id: 'magnet-2' },
  ];
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: leadsData, error: null })
  );

  // 4. post_campaigns active count
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: null, error: null, count: overrides.postCampaignsCount ?? 2 })
  );

  // 5. outreach_campaigns active count
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: null, error: null, count: overrides.outreachCount ?? 1 })
  );

  // 6. lead_magnets total count
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: null, error: null, count: overrides.magnetTotal ?? 5 })
  );

  // 7. lead_magnets published count
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: null, error: null, count: overrides.magnetPublishedCount ?? 3 })
  );

  // 8. lead_magnets title lookup (sequential, only when leadsData has items)
  const leadMagnetsData = overrides.leadMagnetsData ?? [
    { id: 'magnet-1', title: 'GTM Blueprint' },
    { id: 'magnet-2', title: 'Cold Email Guide' },
  ];
  mockSupabaseClient.from.mockImplementationOnce(() =>
    buildChain({ data: leadMagnetsData, error: null })
  );
}

// ─── Tests: fetchBriefingData ─────────────────────────────────────────────────

describe('fetchBriefingData', () => {
  beforeEach(() => {
    // resetAllMocks clears both call history AND mockImplementationOnce queues,
    // preventing leftover slots from bleeding into subsequent tests.
    jest.resetAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    // Re-apply the applyScope implementation after reset removes it.
    (mockApplyScope as jest.Mock).mockImplementation(
      (
        query: Record<string, jest.Mock>,
        scope: { type: string; userId: string; teamId?: string }
      ) => {
        if (scope.type === 'team' && scope.teamId) {
          return query.eq('team_id', scope.teamId);
        }
        return query.eq('user_id', scope.userId);
      }
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns correct queueCount from cp_pipeline_posts reviewing status', async () => {
    mockAllQueries({ queueCount: 7 });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.queueCount).toBe(7);
  });

  it('returns correct scheduledThisWeek count', async () => {
    mockAllQueries({
      scheduledData: [{ scheduled_time: new Date(NOW.getTime() + 1000).toISOString() }],
    });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.scheduledThisWeek).toBe(1);
  });

  it('returns nextScheduledPost as ISO string of the earliest scheduled post', async () => {
    const soon = new Date(NOW.getTime() + 60 * 60 * 1000).toISOString();
    const later = new Date(NOW.getTime() + 2 * 60 * 60 * 1000).toISOString();
    mockAllQueries({ scheduledData: [{ scheduled_time: soon }, { scheduled_time: later }] });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.nextScheduledPost).toBe(soon);
  });

  it('returns nextScheduledPost as null when no scheduled posts', async () => {
    mockAllQueries({ scheduledData: [] });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.nextScheduledPost).toBeNull();
  });

  it('returns correct ideasRemaining count', async () => {
    mockAllQueries({ ideasCount: 8 });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.ideasRemaining).toBe(8);
  });

  it('returns correct newLeadsCount from last 7 days', async () => {
    mockAllQueries({
      leadsData: [
        { lead_magnet_id: 'magnet-1' },
        { lead_magnet_id: 'magnet-1' },
        { lead_magnet_id: 'magnet-1' },
      ],
      leadMagnetsData: [{ id: 'magnet-1', title: 'GTM Blueprint' }],
    });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.newLeadsCount).toBe(3);
  });

  it('groups newLeadsBySource by lead magnet title', async () => {
    mockAllQueries({
      leadsData: [
        { lead_magnet_id: 'magnet-1' },
        { lead_magnet_id: 'magnet-1' },
        { lead_magnet_id: 'magnet-2' },
      ],
      leadMagnetsData: [
        { id: 'magnet-1', title: 'GTM Blueprint' },
        { id: 'magnet-2', title: 'Cold Email Guide' },
      ],
    });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.newLeadsBySource).toEqual(
      expect.arrayContaining([
        { source: 'GTM Blueprint', count: 2 },
        { source: 'Cold Email Guide', count: 1 },
      ])
    );
  });

  it('sorts newLeadsBySource descending by count', async () => {
    mockAllQueries({
      leadsData: [
        { lead_magnet_id: 'magnet-2' },
        { lead_magnet_id: 'magnet-1' },
        { lead_magnet_id: 'magnet-2' },
        { lead_magnet_id: 'magnet-2' },
      ],
      leadMagnetsData: [
        { id: 'magnet-1', title: 'GTM Blueprint' },
        { id: 'magnet-2', title: 'Cold Email Guide' },
      ],
    });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.newLeadsBySource[0].count).toBeGreaterThanOrEqual(
      result.newLeadsBySource[1].count
    );
  });

  it('returns empty newLeadsBySource when no leads this week', async () => {
    mockAllQueries({ leadsData: [], leadMagnetsData: [] });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.newLeadsBySource).toEqual([]);
    expect(result.newLeadsCount).toBe(0);
  });

  it('returns correct activeCampaigns counts', async () => {
    mockAllQueries({ postCampaignsCount: 4, outreachCount: 2 });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.activeCampaigns.postCampaigns).toBe(4);
    expect(result.activeCampaigns.outreachSequences).toBe(2);
  });

  it('returns correct magnetCount and publishedMagnetCount', async () => {
    mockAllQueries({ magnetTotal: 10, magnetPublishedCount: 6 });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.magnetCount).toBe(10);
    expect(result.publishedMagnetCount).toBe(6);
  });

  it('returns autopilotStatus=running when ideas remain and posts are scheduled', async () => {
    mockAllQueries({
      ideasCount: 5,
      scheduledData: [{ scheduled_time: new Date(NOW.getTime() + 1000).toISOString() }],
    });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.autopilotStatus).toBe('running');
  });

  it('returns autopilotStatus=no_ideas when ideasRemaining is 0', async () => {
    mockAllQueries({ ideasCount: 0 });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.autopilotStatus).toBe('no_ideas');
  });

  it('returns autopilotStatus=paused when ideas exist but nothing scheduled', async () => {
    mockAllQueries({ ideasCount: 5, scheduledData: [] });
    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.autopilotStatus).toBe('paused');
  });

  it('applies user_id scope when scope type is user', async () => {
    mockAllQueries();
    await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    // cp_pipeline_posts (queue) query should filter by user_id
    const queueChain = mockSupabaseClient.from.mock.results[0].value;
    expect(queueChain.eq).toHaveBeenCalledWith('user_id', USER_SCOPE.userId);
  });

  it('applies team_id scope when scope type is team for lead_magnets', async () => {
    mockAllQueries();
    await fetchBriefingData(mockSupabaseClient as never, TEAM_SCOPE);
    // lead_magnets total is the 7th parallel query (index 6 in from.mock.results)
    const magnetTotalChain = mockSupabaseClient.from.mock.results[6].value;
    expect(magnetTotalChain.eq).toHaveBeenCalledWith('team_id', TEAM_SCOPE.teamId);
  });

  it('handles nullish counts gracefully (returns 0)', async () => {
    // All results with null counts
    mockSupabaseClient.from.mockImplementation(() =>
      buildChain({ data: [], error: null, count: null })
    );

    const result = await fetchBriefingData(mockSupabaseClient as never, USER_SCOPE);
    expect(result.queueCount).toBe(0);
    expect(result.scheduledThisWeek).toBe(0);
    expect(result.ideasRemaining).toBe(0);
    expect(result.newLeadsCount).toBe(0);
    expect(result.activeCampaigns.postCampaigns).toBe(0);
    expect(result.activeCampaigns.outreachSequences).toBe(0);
    expect(result.magnetCount).toBe(0);
    expect(result.publishedMagnetCount).toBe(0);
  });
});

// ─── Tests: formatBriefingPrompt ─────────────────────────────────────────────

describe('formatBriefingPrompt', () => {
  const baseBriefing: BriefingData = {
    queueCount: 3,
    scheduledThisWeek: 5,
    autopilotStatus: 'running',
    ideasRemaining: 12,
    nextScheduledPost: '2026-03-20T10:00:00Z',
    newLeadsCount: 7,
    newLeadsBySource: [
      { source: 'GTM Blueprint', count: 5 },
      { source: 'Cold Email Guide', count: 2 },
    ],
    activeCampaigns: { postCampaigns: 2, outreachSequences: 1 },
    magnetCount: 5,
    publishedMagnetCount: 3,
  };

  it('includes the section heading', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('## Current Status Briefing');
  });

  it('includes queueCount and scheduledThisWeek', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('3');
    expect(output).toContain('5');
  });

  it('includes autopilot status', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('running');
  });

  it('includes ideasRemaining', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('12');
  });

  it('includes nextScheduledPost when present (formatted as human-readable date)', () => {
    const output = formatBriefingPrompt(baseBriefing);
    // nextScheduledPost = '2026-03-20T10:00:00Z' → formatted as 'Mar 20, 10:00 AM' (UTC)
    expect(output).toMatch(/Mar 20|2026-03-20/);
  });

  it('includes "not scheduled" or similar when nextScheduledPost is null', () => {
    const output = formatBriefingPrompt({ ...baseBriefing, nextScheduledPost: null });
    expect(output.toLowerCase()).toMatch(/none|not scheduled|no upcoming/);
  });

  it('includes newLeadsCount', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('7');
  });

  it('includes lead sources with counts', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('GTM Blueprint');
    expect(output).toContain('Cold Email Guide');
  });

  it('includes activeCampaigns counts', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('2');
    expect(output).toContain('1');
  });

  it('includes magnetCount and publishedMagnetCount', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('5');
    expect(output).toContain('3');
  });

  it('ends with the contextual instruction paragraph', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(output).toContain('homepage');
    expect(output).toContain('Proactively reference');
  });

  it('returns a non-empty string', () => {
    const output = formatBriefingPrompt(baseBriefing);
    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(50);
  });

  it('handles no_ideas autopilot status gracefully', () => {
    const output = formatBriefingPrompt({ ...baseBriefing, autopilotStatus: 'no_ideas' });
    expect(output).toContain('no_ideas');
  });

  it('handles paused autopilot status gracefully', () => {
    const output = formatBriefingPrompt({ ...baseBriefing, autopilotStatus: 'paused' });
    expect(output).toContain('paused');
  });

  it('handles empty newLeadsBySource without crashing', () => {
    expect(() =>
      formatBriefingPrompt({ ...baseBriefing, newLeadsBySource: [], newLeadsCount: 0 })
    ).not.toThrow();
  });
});
