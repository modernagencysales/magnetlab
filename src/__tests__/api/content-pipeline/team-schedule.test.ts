/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock team-integrations service (for team-profile-integrations route)
jest.mock('@/lib/services/team-integrations', () => ({
  getTeamProfilesWithConnections: jest.fn(),
  verifyTeamMembership: jest.fn(),
}));

import { GET } from '@/app/api/content-pipeline/team-schedule/route';
import { POST } from '@/app/api/content-pipeline/team-schedule/assign/route';
import { GET as GET_INTEGRATIONS } from '@/app/api/team-profile-integrations/route';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getTeamProfilesWithConnections, verifyTeamMembership } from '@/lib/services/team-integrations';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockCreateSupabase = createSupabaseAdminClient as jest.Mock;
const mockGetTeamProfilesWithConnections = getTeamProfilesWithConnections as jest.Mock;
const mockVerifyTeamMembership = verifyTeamMembership as jest.Mock;

// Valid UUIDs for Zod validation
const VALID_POST_ID = '11111111-1111-1111-1111-111111111111';
const _VALID_PROFILE_ID = '22222222-2222-2222-2222-222222222222';
const _VALID_TEAM_ID = '33333333-3333-3333-3333-333333333333';

/**
 * Creates a mock Supabase client that supports the chainable query pattern.
 * Each table gets its own chain with configurable results.
 */
function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };

  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.gte = jest.fn(() => chain);
    chain.lte = jest.fn(() => chain);
    chain.order = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.single = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: { message: 'Not found', code: 'PGRST116' } };
      return Promise.resolve(result);
    });
    chain.update = jest.fn(() => chain);

    // Make the chain thenable so `await query` resolves
    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    setTableResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
    },
    reset: () => {
      Object.keys(tableResults).forEach(k => delete tableResults[k]);
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

// ============================================
// GET /api/content-pipeline/team-schedule
// ============================================

describe('GET /api/content-pipeline/team-schedule', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    mockCreateSupabase.mockReturnValue(mock.client);
    // Default: verifyTeamMembership is imported from the real module but we
    // call it via the service mock. However the GET route imports
    // verifyTeamMembership directly — we mocked the whole module above.
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/content-pipeline/team-schedule?team_id=team-1');
    const response = await GET(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 when team_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = new NextRequest('http://localhost:3000/api/content-pipeline/team-schedule');
    const response = await GET(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('team_id');
  });

  it('returns 404 when team does not exist', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockVerifyTeamMembership.mockResolvedValue({ authorized: false, error: 'Team not found', status: 404 });

    const request = new NextRequest('http://localhost:3000/api/content-pipeline/team-schedule?team_id=nonexistent');
    const response = await GET(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Team not found');
  });

  it('returns 403 when user is not a team member', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockVerifyTeamMembership.mockResolvedValue({ authorized: false, error: 'Not a team member', status: 403 });

    const request = new NextRequest('http://localhost:3000/api/content-pipeline/team-schedule?team_id=team-1');
    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Not a team member');
  });

  it('returns empty arrays when team has no active profiles', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockVerifyTeamMembership.mockResolvedValue({ authorized: true, team: { id: 'team-1', owner_id: 'user-1' } });
    mock.setTableResult('team_profiles', { data: [], error: null });

    const request = new NextRequest('http://localhost:3000/api/content-pipeline/team-schedule?team_id=team-1');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.profiles).toEqual([]);
    expect(data.posts).toEqual([]);
    expect(data.slots).toEqual([]);
    expect(data.buffer_posts).toEqual([]);
  });
});

// ============================================
// POST /api/content-pipeline/team-schedule/assign
// ============================================

describe('POST /api/content-pipeline/team-schedule/assign', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    mockCreateSupabase.mockReturnValue(mock.client);
  });

  function createAssignRequest(body: Record<string, unknown>) {
    return new NextRequest('http://localhost:3000/api/content-pipeline/team-schedule/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = createAssignRequest({ post_id: VALID_POST_ID, scheduled_time: '2026-02-26T09:00:00Z' });
    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 when post_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createAssignRequest({ scheduled_time: '2026-02-26T09:00:00Z' });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('returns 400 when scheduled_time is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createAssignRequest({ post_id: VALID_POST_ID });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('returns 400 when post_id is not a valid UUID', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createAssignRequest({
      post_id: 'not-a-uuid',
      scheduled_time: '2026-02-26T09:00:00Z',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 404 when post does not exist', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    });

    const request = createAssignRequest({
      post_id: VALID_POST_ID,
      scheduled_time: '2026-02-26T09:00:00Z',
    });
    const response = await POST(request);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toContain('Post not found');
  });
});

// ============================================
// GET /api/team-profile-integrations
// ============================================

describe('GET /api/team-profile-integrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    mockCreateSupabase.mockReturnValue(mock.client);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/team-profile-integrations?team_id=team-1');
    const response = await GET_INTEGRATIONS(request);

    expect(response.status).toBe(401);
  });

  it('returns 400 when team_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = new NextRequest('http://localhost:3000/api/team-profile-integrations');
    const response = await GET_INTEGRATIONS(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('team_id');
  });

  it('returns 403 when user is not a team member', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockVerifyTeamMembership.mockResolvedValue({ authorized: false, error: 'Not a team member', status: 403 });

    const request = new NextRequest('http://localhost:3000/api/team-profile-integrations?team_id=team-1');
    const response = await GET_INTEGRATIONS(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Not a team member');
  });

  it('returns profiles from getTeamProfilesWithConnections', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mockVerifyTeamMembership.mockResolvedValue({ authorized: true, team: { id: 'team-1', owner_id: 'user-1' } });
    mockGetTeamProfilesWithConnections.mockResolvedValue([
      {
        id: 'profile-1',
        team_id: 'team-1',
        user_id: 'user-1',
        full_name: 'John Doe',
        title: 'CEO',
        linkedin_connected: true,
        unipile_account_id: 'acc-123',
      },
    ]);

    const request = new NextRequest('http://localhost:3000/api/team-profile-integrations?team_id=team-1');
    const response = await GET_INTEGRATIONS(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.profiles).toHaveLength(1);
    expect(data.profiles[0].full_name).toBe('John Doe');
    expect(data.profiles[0].linkedin_connected).toBe(true);
    expect(mockGetTeamProfilesWithConnections).toHaveBeenCalledWith('team-1');
  });
});
