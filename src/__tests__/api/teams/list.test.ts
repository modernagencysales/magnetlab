/**
 * @jest-environment node
 *
 * Tests for GET /api/teams — list teams the current user belongs to.
 * Returns { owned, member, teams } where `teams` is a flat array for MCP use.
 * Uses getUserTeams() from team.repo (V3 — no getMergedMemberships).
 */

import { GET } from '@/app/api/teams/route';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockAuth = jest.fn();
jest.mock('@/lib/auth', () => ({
  auth: () => mockAuth(),
}));

const mockGetUserTeams = jest.fn();
jest.mock('@/server/repositories/team.repo', () => ({
  getUserTeams: (...args: unknown[]) => mockGetUserTeams(...args),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const OWNER_ENTRY = {
  team: {
    id: 'team-uuid-1',
    name: 'Acme Agency',
    owner_id: 'user-123',
    description: null,
    industry: null,
    target_audience: null,
    shared_goal: null,
    billing_team_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  role: 'owner' as const,
  via: 'direct' as const,
};

const MEMBER_ENTRY = {
  team: {
    id: 'team-uuid-2',
    name: 'Partner Co',
    owner_id: 'other-user',
    description: null,
    industry: null,
    target_audience: null,
    shared_goal: null,
    billing_team_id: null,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  },
  role: 'member' as const,
  via: 'direct' as const,
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('GET /api/teams', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('authentication', () => {
    it('returns 401 when unauthenticated', async () => {
      mockAuth.mockResolvedValueOnce(null);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(401);
      expect(body.code).toBe('UNAUTHORIZED');
    });
  });

  describe('happy path', () => {
    it('returns flat teams array with id, name, role for MCP use', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockGetUserTeams.mockResolvedValueOnce([OWNER_ENTRY, MEMBER_ENTRY]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.teams).toHaveLength(2);

      const ownerTeam = body.teams.find((t: { id: string }) => t.id === 'team-uuid-1');
      expect(ownerTeam).toEqual({ id: 'team-uuid-1', name: 'Acme Agency', role: 'owner' });

      const memberTeam = body.teams.find((t: { id: string }) => t.id === 'team-uuid-2');
      expect(memberTeam).toEqual({ id: 'team-uuid-2', name: 'Partner Co', role: 'member' });
    });

    it('returns backward-compat owned and member arrays', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockGetUserTeams.mockResolvedValueOnce([OWNER_ENTRY, MEMBER_ENTRY]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.owned).toHaveLength(1);
      expect(body.owned[0].role).toBe('owner');
      expect(body.member).toHaveLength(1);
      expect(body.member[0].role).toBe('member');
    });

    it('returns empty teams array when user has no teams', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockGetUserTeams.mockResolvedValueOnce([]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.teams).toEqual([]);
      expect(body.owned).toEqual([]);
      expect(body.member).toEqual([]);
    });

    it('each team entry includes the team id usable as team_id param', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockGetUserTeams.mockResolvedValueOnce([OWNER_ENTRY]);

      const response = await GET();
      const body = await response.json();

      expect(response.status).toBe(200);
      // team.id must be a non-empty string (usable as team_id in MCP tool params)
      expect(typeof body.teams[0].id).toBe('string');
      expect(body.teams[0].id.length).toBeGreaterThan(0);
    });

    it('passes userId to getUserTeams', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-abc' } });
      mockGetUserTeams.mockResolvedValueOnce([]);

      await GET();

      expect(mockGetUserTeams).toHaveBeenCalledWith('user-abc');
    });
  });

  describe('error handling', () => {
    it('returns 500 when getUserTeams throws', async () => {
      mockAuth.mockResolvedValueOnce({ user: { id: 'user-123' } });
      mockGetUserTeams.mockRejectedValueOnce(new Error('DB connection failed'));

      const response = await GET();

      expect(response.status).toBe(500);
    });
  });
});
