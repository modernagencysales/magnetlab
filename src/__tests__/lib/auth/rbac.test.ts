/**
 * @jest-environment node
 */

jest.mock('@/server/repositories/team.repo');

import { checkTeamRole, hasMinimumRole, TeamRole } from '@/lib/auth/rbac';
import { hasTeamAccess as mockHasTeamAccess } from '@/server/repositories/team.repo';

const mockHasTeamAccessFn = mockHasTeamAccess as jest.MockedFunction<typeof mockHasTeamAccess>;

describe('RBAC utilities', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkTeamRole', () => {
    it('returns "owner" for team owner', async () => {
      mockHasTeamAccessFn.mockResolvedValueOnce({
        access: true,
        role: 'owner',
        via: 'direct',
      });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('owner');
      expect(mockHasTeamAccessFn).toHaveBeenCalledWith('user-1', 'team-1');
    });

    it('returns "member" for active team member via team_members', async () => {
      mockHasTeamAccessFn.mockResolvedValueOnce({
        access: true,
        role: 'member',
        via: 'direct',
      });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('member');
      expect(mockHasTeamAccessFn).toHaveBeenCalledWith('user-1', 'team-1');
    });

    it('returns "member" for active team member via team_profiles', async () => {
      mockHasTeamAccessFn.mockResolvedValueOnce({
        access: true,
        role: 'member',
        via: 'direct',
      });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('member');
      expect(mockHasTeamAccessFn).toHaveBeenCalledWith('user-1', 'team-1');
    });

    it('returns null for non-member', async () => {
      mockHasTeamAccessFn.mockResolvedValueOnce({
        access: false,
        role: 'member',
        via: 'direct',
      });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBeNull();
      expect(mockHasTeamAccessFn).toHaveBeenCalledWith('user-1', 'team-1');
    });

    it('returns null when team does not exist', async () => {
      mockHasTeamAccessFn.mockResolvedValueOnce({
        access: false,
        role: 'member',
        via: 'direct',
      });

      const role = await checkTeamRole('user-1', 'nonexistent-team');
      expect(role).toBeNull();
      expect(mockHasTeamAccessFn).toHaveBeenCalledWith('user-1', 'nonexistent-team');
    });

    it('returns "member" for member with owner role in team_members (V1 ignores role column)', async () => {
      mockHasTeamAccessFn.mockResolvedValueOnce({
        access: true,
        role: 'member',
        via: 'direct',
      });

      const role = await checkTeamRole('user-1', 'team-1');
      expect(role).toBe('member');
      expect(mockHasTeamAccessFn).toHaveBeenCalledWith('user-1', 'team-1');
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
