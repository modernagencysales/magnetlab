import {
  TeamMember,
  TeamLink,
  TeamProfile,
  Team,
  PostTemplate,
} from '@/lib/types/content-pipeline';
import { DataScope } from '@/lib/utils/team-context';
import { ActionContext } from '@/lib/actions/types';

describe('Teams V3 type definitions', () => {
  it('TeamMember has correct shape', () => {
    const member: TeamMember = {
      id: '1',
      team_id: '2',
      user_id: '3',
      role: 'owner',
      status: 'active',
      joined_at: '2026-01-01',
    };
    expect(member.role).toBe('owner');
  });

  it('TeamLink has correct shape', () => {
    const link: TeamLink = {
      id: '1',
      agency_team_id: '2',
      client_team_id: '3',
      created_at: '2026-01-01',
    };
    expect(link.agency_team_id).toBe('2');
  });

  it('TeamProfile no longer has role/invited_at/accepted_at', () => {
    const profile = { id: '1', team_id: '2', full_name: 'Test' } as TeamProfile;
    // @ts-expect-error role should not exist on TeamProfile
    const _role = (profile as Record<string, unknown>).role;
    expect(typeof profile.full_name).toBe('string');
  });

  it('Team has billing_team_id', () => {
    const team = { billing_team_id: 'abc' } as Team;
    expect(team.billing_team_id).toBe('abc');
  });

  it('PostTemplate has team_id', () => {
    const tmpl = { team_id: 'abc' } as PostTemplate;
    expect(tmpl.team_id).toBe('abc');
  });

  it('DataScope has billingUserId not ownerId', () => {
    const scope: DataScope = { type: 'team', userId: '1', teamId: '2', billingUserId: '3' };
    expect(scope.billingUserId).toBe('3');
    // @ts-expect-error ownerId should not exist
    const _old = (scope as Record<string, unknown>).ownerId;
  });

  it('ActionContext uses scope not userId/teamId', () => {
    const ctx: ActionContext = {
      scope: { type: 'user', userId: '1' },
    };
    expect(ctx.scope.type).toBe('user');
  });
});
