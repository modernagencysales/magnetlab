/**
 * @jest-environment node
 *
 * Tests for GET /api/teams/members and POST /api/teams/members.
 * GET: list active members of a team (requires team access).
 * POST: add a member to a team (owner only).
 * Mocks team.repo and auth directly — does not hit Supabase.
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/teams/members/route';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

const mockHasTeamAccess = jest.fn();
const mockListMembers = jest.fn();
const mockAddMember = jest.fn();

jest.mock('@/server/repositories/team.repo', () => ({
  hasTeamAccess: (...args: unknown[]) => mockHasTeamAccess(...args),
  listMembers: (...args: unknown[]) => mockListMembers(...args),
  addMember: (...args: unknown[]) => mockAddMember(...args),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { auth } from '@/lib/auth';

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEAM_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const NEW_USER_ID = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

const MOCK_SESSION = {
  user: { id: USER_ID, email: 'owner@agency.com', name: 'Team Owner' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

const MEMBER_1 = {
  id: 'member-uuid-1',
  team_id: TEAM_ID,
  user_id: USER_ID,
  role: 'owner',
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
};

const MEMBER_2 = {
  id: 'member-uuid-2',
  team_id: TEAM_ID,
  user_id: NEW_USER_ID,
  role: 'member',
  status: 'active',
  joined_at: '2026-02-01T00:00:00Z',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setAuth(session: typeof MOCK_SESSION | null = MOCK_SESSION) {
  (auth as jest.Mock).mockResolvedValue(session);
}

function makeGetRequest(teamId?: string) {
  const url = teamId
    ? `http://localhost/api/teams/members?team_id=${teamId}`
    : 'http://localhost/api/teams/members';
  return new NextRequest(url, { method: 'GET' });
}

function makePostRequest(body: unknown) {
  return new NextRequest('http://localhost/api/teams/members', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ─── GET /api/teams/members ───────────────────────────────────────────────────

describe('GET /api/teams/members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setAuth(null);

    const response = await GET(makeGetRequest(TEAM_ID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 when team_id query param is missing', async () => {
    setAuth();

    const response = await GET(makeGetRequest());
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when team_id is not a valid UUID', async () => {
    setAuth();

    const response = await GET(makeGetRequest('not-a-uuid'));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when caller does not have team access', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: false, role: 'member', via: 'direct' });

    const response = await GET(makeGetRequest(TEAM_ID));

    expect(response.status).toBe(403);
  });

  it('lists members when caller has team access', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'owner', via: 'direct' });
    mockListMembers.mockResolvedValueOnce([MEMBER_1, MEMBER_2]);

    const response = await GET(makeGetRequest(TEAM_ID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.members).toHaveLength(2);
    expect(body.members[0]).toEqual(MEMBER_1);
  });

  it('calls hasTeamAccess with the caller user id and team id', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'member', via: 'direct' });
    mockListMembers.mockResolvedValueOnce([]);

    await GET(makeGetRequest(TEAM_ID));

    expect(mockHasTeamAccess).toHaveBeenCalledWith(USER_ID, TEAM_ID);
  });

  it('works for a member-role caller (read is allowed for any member)', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'member', via: 'direct' });
    mockListMembers.mockResolvedValueOnce([MEMBER_1]);

    const response = await GET(makeGetRequest(TEAM_ID));

    expect(response.status).toBe(200);
  });

  it('returns 500 when listMembers throws', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'owner', via: 'direct' });
    mockListMembers.mockRejectedValueOnce(new Error('DB error'));

    const response = await GET(makeGetRequest(TEAM_ID));

    expect(response.status).toBe(500);
  });
});

// ─── POST /api/teams/members ──────────────────────────────────────────────────

describe('POST /api/teams/members', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    setAuth(null);

    const response = await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('returns 400 for invalid JSON body', async () => {
    setAuth();

    const request = new NextRequest('http://localhost/api/teams/members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when team_id is missing', async () => {
    setAuth();

    const response = await POST(makePostRequest({ user_id: NEW_USER_ID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when user_id is missing', async () => {
    setAuth();

    const response = await POST(makePostRequest({ team_id: TEAM_ID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when team_id is not a valid UUID', async () => {
    setAuth();

    const response = await POST(makePostRequest({ team_id: 'bad-id', user_id: NEW_USER_ID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 403 when caller is not the team owner', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'member', via: 'direct' });

    const response = await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));

    expect(response.status).toBe(403);
  });

  it('returns 403 when caller has no team access', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: false, role: 'member', via: 'direct' });

    const response = await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));

    expect(response.status).toBe(403);
  });

  it('adds a member when caller is team owner', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'owner', via: 'direct' });
    mockAddMember.mockResolvedValueOnce(MEMBER_2);

    const response = await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.member).toEqual(MEMBER_2);
  });

  it('defaults role to member when not specified', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'owner', via: 'direct' });
    mockAddMember.mockResolvedValueOnce(MEMBER_2);

    await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));

    expect(mockAddMember).toHaveBeenCalledWith(TEAM_ID, NEW_USER_ID, 'member');
  });

  it('calls hasTeamAccess with the caller user id', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'owner', via: 'direct' });
    mockAddMember.mockResolvedValueOnce(MEMBER_2);

    await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));

    expect(mockHasTeamAccess).toHaveBeenCalledWith(USER_ID, TEAM_ID);
  });

  it('returns 500 when addMember throws', async () => {
    setAuth();
    mockHasTeamAccess.mockResolvedValueOnce({ access: true, role: 'owner', via: 'direct' });
    mockAddMember.mockRejectedValueOnce(new Error('Unique constraint violation'));

    const response = await POST(makePostRequest({ team_id: TEAM_ID, user_id: NEW_USER_ID }));

    expect(response.status).toBe(500);
  });
});
