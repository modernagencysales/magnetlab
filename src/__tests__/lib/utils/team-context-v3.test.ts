/**
 * @jest-environment node
 *
 * Tests for Teams V3 access layer rewrite:
 * - getDataScope with hasTeamAccess, billingUserId, requestTeamId
 * - getScopeForResource with team links
 * - requireTeamScope via hasTeamAccess
 * - getBillingTeamId helper
 */

// ─── Mocks (must be before imports, use jest hoisting-safe pattern) ──────────

jest.mock('@/server/repositories/team.repo', () => ({
  hasTeamAccess: jest.fn(),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: jest.fn(),
  })),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(),
  headers: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logWarn: jest.fn(),
}));

import { getDataScope, requireTeamScope, getScopeForResource } from '@/lib/utils/team-context';
import { getBillingTeamId } from '@/lib/auth/plan-limits';
import { hasTeamAccess } from '@/server/repositories/team.repo';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { cookies, headers } from 'next/headers';

const mockHasTeamAccess = hasTeamAccess as jest.MockedFunction<typeof hasTeamAccess>;
const mockCreateAdmin = createSupabaseAdminClient as jest.MockedFunction<typeof createSupabaseAdminClient>;
const mockCookies = cookies as jest.MockedFunction<typeof cookies>;
const mockHeaders = headers as jest.MockedFunction<typeof headers>;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Build a chainable Supabase mock that resolves to a value at .single() or .maybeSingle(). */
function mockSupabaseChain(data: unknown, error: unknown = null) {
  const end = { data, error };
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(end);
  chain.maybeSingle = jest.fn().mockResolvedValue(end);
  return chain;
}

/** Set up the supabase admin mock to return different chains per table. */
function setupSupabaseMock(tableMap: Record<string, unknown>) {
  const mockFrom = jest.fn((table: string) => {
    const data = tableMap[table] ?? null;
    return mockSupabaseChain(data);
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateAdmin.mockReturnValue({ from: mockFrom } as any);
  return mockFrom;
}

/** Set up the supabase admin mock with a custom from implementation. */
function setupSupabaseMockFn(fn: (table: string) => ReturnType<typeof mockSupabaseChain>) {
  const mockFrom = jest.fn(fn);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCreateAdmin.mockReturnValue({ from: mockFrom } as any);
  return mockFrom;
}

/** Set up cookie mock — pass null for no cookie, or a string value. */
function setupCookieMock(teamContextValue: string | null) {
  const mockGet = jest.fn((name: string) =>
    name === 'ml-team-context' && teamContextValue
      ? { value: teamContextValue }
      : undefined
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockCookies.mockResolvedValue({ get: mockGet } as any);
}

/** Default headers mock (no API key). */
function setupHeadersMock(authHeader: string | null = null) {
  const mockGet = jest.fn((name: string) =>
    name === 'authorization' ? authHeader : null
  );
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mockHeaders.mockResolvedValue({ get: mockGet } as any);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('getDataScope (V3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCookieMock(null);
    setupHeadersMock(null);
  });

  it('returns team scope when cookie is set and hasTeamAccess passes', async () => {
    setupCookieMock('team-abc');
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'owner', via: 'direct' });
    setupSupabaseMock({
      teams: { owner_id: 'owner-user-id', billing_team_id: null },
    });

    const scope = await getDataScope('user-1');

    expect(mockHasTeamAccess).toHaveBeenCalledWith('user-1', 'team-abc');
    expect(scope).toEqual({
      type: 'team',
      userId: 'user-1',
      teamId: 'team-abc',
      billingUserId: 'owner-user-id',
    });
  });

  it('returns team scope when requestTeamId param is provided (MCP path)', async () => {
    setupCookieMock(null);
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'member', via: 'team_link' });
    setupSupabaseMock({
      teams: { owner_id: 'client-owner', billing_team_id: null },
    });

    const scope = await getDataScope('user-1', 'team-mcp');

    expect(mockHasTeamAccess).toHaveBeenCalledWith('user-1', 'team-mcp');
    expect(scope).toEqual({
      type: 'team',
      userId: 'user-1',
      teamId: 'team-mcp',
      billingUserId: 'client-owner',
    });
  });

  it('returns personal mode when no cookie, no requestTeamId, multi-team user', async () => {
    setupCookieMock(null);
    setupHeadersMock(null);

    const scope = await getDataScope('user-1');

    expect(scope).toEqual({ type: 'user', userId: 'user-1' });
    expect(mockHasTeamAccess).not.toHaveBeenCalled();
  });

  it('resolves billingUserId from billing_team_id when set', async () => {
    setupCookieMock('client-team');
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'member', via: 'direct' });

    // First call: team with billing_team_id set. Second call: billing team owner lookup.
    let callCount = 0;
    setupSupabaseMockFn(() => {
      callCount++;
      if (callCount === 1) {
        return mockSupabaseChain({ owner_id: 'client-owner', billing_team_id: 'agency-team' });
      }
      return mockSupabaseChain({ owner_id: 'agency-owner' });
    });

    const scope = await getDataScope('user-1');

    expect(scope).toEqual({
      type: 'team',
      userId: 'user-1',
      teamId: 'client-team',
      billingUserId: 'agency-owner',
    });
  });

  it('resolves billingUserId as own owner_id when billing_team_id is NULL', async () => {
    setupCookieMock('team-self');
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'owner', via: 'direct' });
    setupSupabaseMock({
      teams: { owner_id: 'self-owner', billing_team_id: null },
    });

    const scope = await getDataScope('user-1');

    expect(scope.billingUserId).toBe('self-owner');
  });

  it('falls back to personal mode when cookie team fails access check', async () => {
    setupCookieMock('team-no-access');
    mockHasTeamAccess.mockResolvedValue({ access: false, role: 'member', via: 'direct' });
    setupHeadersMock(null);

    const scope = await getDataScope('user-1');

    expect(scope).toEqual({ type: 'user', userId: 'user-1' });
  });

  it('skips requestTeamId when cookie is present', async () => {
    setupCookieMock('cookie-team');
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'owner', via: 'direct' });
    setupSupabaseMock({
      teams: { owner_id: 'owner-1', billing_team_id: null },
    });

    const scope = await getDataScope('user-1', 'request-team');

    expect(mockHasTeamAccess).toHaveBeenCalledWith('user-1', 'cookie-team');
    expect(scope.teamId).toBe('cookie-team');
  });
});

describe('getScopeForResource (V3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCookieMock(null);
    setupHeadersMock(null);
  });

  it('uses hasTeamAccess to check cross-team access (works through team links)', async () => {
    // No cookie → getDataScope returns personal mode
    setupCookieMock(null);
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'member', via: 'team_link' });
    setupSupabaseMock({
      teams: { owner_id: 'resource-owner', billing_team_id: null },
    });

    const scope = await getScopeForResource('user-1', 'resource-team-id');

    expect(mockHasTeamAccess).toHaveBeenCalledWith('user-1', 'resource-team-id');
    expect(scope).toEqual({
      type: 'team',
      userId: 'user-1',
      teamId: 'resource-team-id',
      billingUserId: 'resource-owner',
    });
  });

  it('returns cookie scope when resource has no team_id', async () => {
    setupCookieMock(null);

    const scope = await getScopeForResource('user-1', null);

    expect(scope).toEqual({ type: 'user', userId: 'user-1' });
  });

  it('returns cookie scope unchanged when it already matches the resource team', async () => {
    setupCookieMock('team-match');
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'owner', via: 'direct' });
    setupSupabaseMock({
      teams: { owner_id: 'owner-1', billing_team_id: null },
    });

    const scope = await getScopeForResource('user-1', 'team-match');

    // getDataScope resolved cookie to team-match, resource is also team-match → no extra check
    expect(scope.teamId).toBe('team-match');
  });
});

describe('requireTeamScope (V3)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupCookieMock(null);
    setupHeadersMock(null);
  });

  it('uses hasTeamAccess when cookie resolves team', async () => {
    setupCookieMock('team-req');
    mockHasTeamAccess.mockResolvedValue({ access: true, role: 'owner', via: 'direct' });
    setupSupabaseMock({
      teams: { owner_id: 'team-owner', billing_team_id: null },
    });

    const scope = await requireTeamScope('user-1');

    expect(scope).not.toBeNull();
    expect(scope!.type).toBe('team');
    expect(scope!.teamId).toBe('team-req');
    expect(mockHasTeamAccess).toHaveBeenCalledWith('user-1', 'team-req');
  });

  it('falls back to team_members lookup when no cookie', async () => {
    setupCookieMock(null);

    // resolveTeamForApiKey queries team_members then teams
    let callCount = 0;
    setupSupabaseMockFn(() => {
      callCount++;
      if (callCount === 1) {
        // team_members owner lookup
        return mockSupabaseChain({ team_id: 'fallback-team' });
      }
      // teams table for billing resolution
      return mockSupabaseChain({ owner_id: 'fallback-owner', billing_team_id: null });
    });

    const scope = await requireTeamScope('user-1');

    expect(scope).not.toBeNull();
    expect(scope!.teamId).toBe('fallback-team');
  });

  it('returns null when user has no team at all', async () => {
    setupCookieMock(null);
    setupSupabaseMock({}); // All tables return null

    const scope = await requireTeamScope('user-1');

    expect(scope).toBeNull();
  });
});

describe('getBillingTeamId', () => {
  it('returns billing_team_id when set', () => {
    expect(getBillingTeamId({ id: 'team-1', billing_team_id: 'billing-team' })).toBe('billing-team');
  });

  it('returns team.id when billing_team_id is NULL', () => {
    expect(getBillingTeamId({ id: 'team-1', billing_team_id: null })).toBe('team-1');
  });
});
