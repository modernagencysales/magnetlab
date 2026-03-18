/**
 * @jest-environment node
 *
 * Tests for /api/teams/links (GET, POST) and /api/teams/links/[id] (DELETE)
 * Mocks teamsService and auth. Does not hit Supabase.
 */

import { NextRequest } from 'next/server';
import { GET, POST } from '@/app/api/teams/links/route';
import { DELETE } from '@/app/api/teams/links/[id]/route';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/server/services/teams.service', () => ({
  listTeamLinks: jest.fn(),
  createTeamLink: jest.fn(),
  deleteTeamLink: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { auth } from '@/lib/auth';
import * as teamsService from '@/server/services/teams.service';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_SESSION = {
  user: { id: 'user-owner', email: 'owner@agency.com', name: 'Agency Owner' },
  expires: new Date(Date.now() + 86400000).toISOString(),
};

function mockAuth(session: typeof MOCK_SESSION | null = MOCK_SESSION) {
  (auth as jest.Mock).mockResolvedValue(session);
}

function makeRequest(body?: unknown, method = 'POST') {
  const url = 'http://localhost/api/teams/links';
  if (body === undefined) return new NextRequest(url, { method });
  return new NextRequest(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const LINK_1 = {
  id: 'link-1',
  agency_team_id: 'agency-team-id',
  client_team_id: 'client-team-id',
  created_at: '2026-03-17T00:00:00Z',
};

// ─── GET /api/teams/links ─────────────────────────────────────────────────────

describe('GET /api/teams/links', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it('returns links for authenticated user', async () => {
    mockAuth();
    (teamsService.listTeamLinks as jest.Mock).mockResolvedValue({ links: [LINK_1] });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.links).toEqual([LINK_1]);
    expect(teamsService.listTeamLinks).toHaveBeenCalledWith('user-owner');
  });

  it('returns empty links array when user has no owned team', async () => {
    mockAuth();
    (teamsService.listTeamLinks as jest.Mock).mockResolvedValue({ links: [] });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.links).toEqual([]);
  });

  it('returns 500 on unexpected service error', async () => {
    mockAuth();
    (teamsService.listTeamLinks as jest.Mock).mockRejectedValue(new Error('DB failure'));

    const response = await GET();
    expect(response.status).toBe(500);
  });
});

// ─── POST /api/teams/links ────────────────────────────────────────────────────

describe('POST /api/teams/links', () => {
  const validBody = {
    agency_team_id: '11111111-1111-1111-1111-111111111111',
    client_team_id: '22222222-2222-2222-2222-222222222222',
  };

  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    const request = makeRequest(validBody);
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('creates a team link and returns 201', async () => {
    mockAuth();
    (teamsService.createTeamLink as jest.Mock).mockResolvedValue({ link: LINK_1 });

    const request = makeRequest(validBody);
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.link).toEqual(LINK_1);
    expect(teamsService.createTeamLink).toHaveBeenCalledWith(
      'user-owner',
      validBody.agency_team_id,
      validBody.client_team_id
    );
  });

  it('returns 400 when agency_team_id is missing', async () => {
    mockAuth();
    const request = makeRequest({ client_team_id: '22222222-2222-2222-2222-222222222222' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when agency_team_id is not a valid UUID', async () => {
    mockAuth();
    const request = makeRequest({ agency_team_id: 'not-a-uuid', client_team_id: '22222222-2222-2222-2222-222222222222' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when client_team_id is missing', async () => {
    mockAuth();
    const request = makeRequest({ agency_team_id: '11111111-1111-1111-1111-111111111111' });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 400 when body is invalid JSON', async () => {
    mockAuth();
    const request = new NextRequest('http://localhost/api/teams/links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it('returns 403 when user is not the agency team owner', async () => {
    mockAuth();
    const err = Object.assign(new Error('Must be agency team owner to create a link'), {
      statusCode: 403,
    });
    (teamsService.createTeamLink as jest.Mock).mockRejectedValue(err);

    const request = makeRequest(validBody);
    const response = await POST(request);
    expect(response.status).toBe(403);
  });

  it('returns 404 when agency or client team does not exist', async () => {
    mockAuth();
    const err = Object.assign(new Error('Client team not found'), { statusCode: 404 });
    (teamsService.createTeamLink as jest.Mock).mockRejectedValue(err);

    const request = makeRequest(validBody);
    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it('returns 400 when agency and client teams are the same', async () => {
    mockAuth();
    const err = Object.assign(new Error('Agency and client teams must be different'), {
      statusCode: 400,
    });
    (teamsService.createTeamLink as jest.Mock).mockRejectedValue(err);

    const request = makeRequest({
      agency_team_id: '11111111-1111-1111-1111-111111111111',
      client_team_id: '11111111-1111-1111-1111-111111111111',
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});

// ─── DELETE /api/teams/links/[id] ────────────────────────────────────────────

describe('DELETE /api/teams/links/[id]', () => {
  const makeParams = (id: string) => ({ params: Promise.resolve({ id }) });

  it('returns 401 when not authenticated', async () => {
    mockAuth(null);
    const response = await DELETE(new Request('http://localhost'), makeParams('link-1'));
    expect(response.status).toBe(401);
  });

  it('removes the link and returns 200', async () => {
    mockAuth();
    (teamsService.deleteTeamLink as jest.Mock).mockResolvedValue({ success: true });

    const response = await DELETE(new Request('http://localhost'), makeParams('link-1'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(teamsService.deleteTeamLink).toHaveBeenCalledWith('user-owner', 'link-1');
  });

  it('returns 403 when user is not owner of either team', async () => {
    mockAuth();
    const err = Object.assign(new Error('Must be owner of either team to remove a link'), {
      statusCode: 403,
    });
    (teamsService.deleteTeamLink as jest.Mock).mockRejectedValue(err);

    const response = await DELETE(new Request('http://localhost'), makeParams('link-1'));
    expect(response.status).toBe(403);
  });

  it('returns 404 when the link does not exist', async () => {
    mockAuth();
    const err = Object.assign(new Error('Team link not found'), { statusCode: 404 });
    (teamsService.deleteTeamLink as jest.Mock).mockRejectedValue(err);

    const response = await DELETE(new Request('http://localhost'), makeParams('ghost-link'));
    expect(response.status).toBe(404);
  });

  it('returns 500 on unexpected error', async () => {
    mockAuth();
    (teamsService.deleteTeamLink as jest.Mock).mockRejectedValue(new Error('DB failure'));

    const response = await DELETE(new Request('http://localhost'), makeParams('link-1'));
    expect(response.status).toBe(500);
  });
});
