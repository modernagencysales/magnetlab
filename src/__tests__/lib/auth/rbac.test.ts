/**
 * @jest-environment node
 */

// Mock supabase before importing the module under test
interface MockChain {
  eq: jest.Mock;
  single: jest.Mock;
}

const mockSingle = jest.fn();
const mockEq: jest.Mock = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

// Wire up chain returns
function setupChain(): void {
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle } as MockChain);
}
setupChain();

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

import { checkTeamRole, hasMinimumRole, TeamRole } from '@/lib/auth/rbac';

describe('RBAC utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupChain();
  });

  describe('checkTeamRole', () => {
    it('returns "owner" for team owner', async () => {
      // First call: teams table lookup
      mockSingle.mockResolvedValueOnce({ data: { owner_id: 'user-1' }, error: null });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('owner');
      expect(mockFrom).toHaveBeenCalledWith('teams');
    });

    it('returns "member" for active team member via team_members', async () => {
      // First call: teams table lookup (user is not owner)
      mockSingle.mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null });
      // Second call: team_members lookup
      mockSingle.mockResolvedValueOnce({ data: { role: 'member', status: 'active' }, error: null });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('member');
    });

    it('returns "member" for active team member via team_profiles', async () => {
      // First call: teams table (not owner)
      mockSingle.mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null });
      // Second call: team_members (no match)
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      // Third call: team_profiles
      mockSingle.mockResolvedValueOnce({ data: { role: 'member', status: 'active' }, error: null });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('member');
    });

    it('returns null for non-member', async () => {
      // First call: teams table (team exists, not owner)
      mockSingle.mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null });
      // Second call: team_members (no match)
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });
      // Third call: team_profiles (no match)
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBeNull();
    });

    it('returns null when team does not exist', async () => {
      mockSingle.mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      const role = await checkTeamRole('user-1', 'nonexistent-team');
      expect(role).toBeNull();
    });

    it('returns "owner" for member with owner role in team_members', async () => {
      // teams table: user is not the direct owner
      mockSingle.mockResolvedValueOnce({ data: { owner_id: 'other-user' }, error: null });
      // team_members: role is 'owner'
      mockSingle.mockResolvedValueOnce({ data: { role: 'owner', status: 'active' }, error: null });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('owner');
    });
  });

  describe('hasMinimumRole', () => {
    it('owner satisfies "owner" requirement', () => {
      expect(hasMinimumRole('owner', 'owner')).toBe(true);
    });

    it('owner satisfies "member" requirement', () => {
      expect(hasMinimumRole('owner', 'member')).toBe(true);
    });

    it('member satisfies "member" requirement', () => {
      expect(hasMinimumRole('member', 'member')).toBe(true);
    });

    it('member does NOT satisfy "owner" requirement', () => {
      expect(hasMinimumRole('member', 'owner')).toBe(false);
    });

    it('null fails "member" requirement', () => {
      expect(hasMinimumRole(null, 'member')).toBe(false);
    });

    it('null fails "owner" requirement', () => {
      expect(hasMinimumRole(null, 'owner')).toBe(false);
    });

    it('handles all role combinations correctly', () => {
      const cases: Array<[TeamRole, 'owner' | 'member', boolean]> = [
        ['owner', 'owner', true],
        ['owner', 'member', true],
        ['member', 'owner', false],
        ['member', 'member', true],
        [null, 'owner', false],
        [null, 'member', false],
      ];

      for (const [actual, required, expected] of cases) {
        expect(hasMinimumRole(actual, required)).toBe(expected);
      }
    });
  });
});
