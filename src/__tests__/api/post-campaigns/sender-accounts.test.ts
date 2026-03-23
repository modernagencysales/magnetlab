/**
 * @jest-environment node
 *
 * API route tests for GET /api/post-campaigns/sender-accounts.
 * Tests auth, team vs personal scope, and connected-profile filtering.
 */

// ─── Mocks ──────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockGetDataScope = jest.fn();
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: (...args: unknown[]) => mockGetDataScope(...args),
}));

const mockGetProfiles = jest.fn();
jest.mock('@/lib/services/team-integrations', () => ({
  getTeamProfilesWithConnections: (...args: unknown[]) => mockGetProfiles(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/post-campaigns/sender-accounts', () => {
  let GET: () => Promise<Response>;

  beforeAll(async () => {
    const mod = await import('@/app/api/post-campaigns/sender-accounts/route');
    GET = mod.GET;
  });

  beforeEach(() => jest.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns empty array for personal scope (no team)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'user', userId: 'u1' });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.accounts).toEqual([]);
  });

  it('returns only connected profiles for team scope', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockGetProfiles.mockResolvedValue([
      { id: 'p1', full_name: 'Christian', linkedin_connected: true, unipile_account_id: 'acc1' },
      { id: 'p2', full_name: 'Vlad', linkedin_connected: false, unipile_account_id: null },
    ]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.accounts).toHaveLength(1);
    expect(body.accounts[0]).toEqual({
      team_profile_id: 'p1',
      name: 'Christian',
      unipile_account_id: 'acc1',
    });
    expect(mockGetProfiles).toHaveBeenCalledWith('t1');
  });

  it('returns empty array when team scope has teamId but no profiles', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockGetProfiles.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.accounts).toEqual([]);
  });

  it('returns 500 when service throws', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'u1' } });
    mockGetDataScope.mockResolvedValue({ type: 'team', userId: 'u1', teamId: 't1' });
    mockGetProfiles.mockRejectedValue(new Error('DB down'));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
