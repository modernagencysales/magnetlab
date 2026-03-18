/**
 * @jest-environment node
 *
 * Tests for src/server/repositories/team.repo.ts
 * All Supabase calls are mocked via createSupabaseAdminClient.
 */

import {
  hasTeamAccess,
  getUserTeams,
  addMember,
  removeMember,
  listMembers,
  createTeamLink,
  deleteTeamLink,
  listTeamLinks,
  getTeamProfiles,
  getDefaultProfile,
  getTeamProfileIds,
} from '@/server/repositories/team.repo';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock Supabase builder ──────────────────────────────────────────────────

/**
 * Creates a chainable mock Supabase client.
 * Each from() call returns a fresh chain. Use setResult() to control
 * what the terminal call (single/maybeSingle/then) resolves with.
 */
function createMockChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {};

  const makeChainable = () => {
    const methods = [
      'select', 'insert', 'update', 'delete', 'eq', 'neq', 'in', 'or',
      'order', 'limit', 'range', 'maybeSingle', 'single',
    ];
    for (const m of methods) {
      chain[m] = jest.fn(() => chain);
    }
    // Terminal calls resolve to result
    chain.single = jest.fn(() => Promise.resolve(result));
    chain.maybeSingle = jest.fn(() => Promise.resolve(result));
    // When used as a thenable (for queries without terminal call)
    chain.then = jest.fn((resolve: (val: unknown) => void) => resolve(result));
    return chain;
  };

  makeChainable();
  return chain;
}

function setupMockClient(results: Array<{ data: unknown; error: unknown }> = []) {
  let callIndex = 0;
  const defaultResult = { data: null, error: null };

  const client = {
    from: jest.fn(() => {
      const result = results[callIndex] ?? defaultResult;
      callIndex++;
      return createMockChain(result);
    }),
  };

  (createSupabaseAdminClient as jest.Mock).mockReturnValue(client);
  return client;
}

// ─── Test data ──────────────────────────────────────────────────────────────

const TEAM_1 = {
  id: 'team-1',
  owner_id: 'user-owner',
  name: 'Agency Team',
  description: null,
  industry: 'SaaS',
  target_audience: 'B2B',
  shared_goal: null,
  billing_team_id: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const TEAM_2 = {
  id: 'team-2',
  owner_id: 'user-client',
  name: 'Client Team',
  description: null,
  industry: null,
  target_audience: null,
  shared_goal: null,
  billing_team_id: 'team-1',
  created_at: '2026-02-01T00:00:00Z',
  updated_at: '2026-02-01T00:00:00Z',
};

const MEMBER_1 = {
  id: 'member-1',
  team_id: 'team-1',
  user_id: 'user-owner',
  role: 'owner',
  status: 'active',
  joined_at: '2026-01-01T00:00:00Z',
};

const PROFILE_1 = {
  id: 'profile-1',
  team_id: 'team-1',
  user_id: 'user-owner',
  email: 'owner@agency.com',
  full_name: 'Jane Agency',
  title: 'CEO',
  linkedin_url: null,
  bio: null,
  expertise_areas: [],
  voice_profile: {},
  avatar_url: null,
  status: 'active',
  is_default: true,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

const LINK_1 = {
  id: 'link-1',
  agency_team_id: 'team-1',
  client_team_id: 'team-2',
  created_at: '2026-02-15T00:00:00Z',
};

// ─── hasTeamAccess ──────────────────────────────────────────────────────────

describe('hasTeamAccess', () => {
  it('returns direct access when user is a direct member', async () => {
    // First from() = team_members query → returns direct match
    setupMockClient([
      { data: { role: 'owner' }, error: null },
    ]);

    const result = await hasTeamAccess('user-owner', 'team-1');

    expect(result).toEqual({ access: true, role: 'owner', via: 'direct' });
  });

  it('returns member role when user has team_link access', async () => {
    // First from() = team_members direct → no match
    // Second from() = team_links → returns agency IDs
    // Third from() = team_members check on agency team → match
    setupMockClient([
      { data: null, error: null },
      { data: [{ agency_team_id: 'team-1' }], error: null },
      { data: { id: 'member-x' }, error: null },
    ]);

    const result = await hasTeamAccess('user-agency', 'team-2');

    expect(result).toEqual({ access: true, role: 'member', via: 'team_link' });
  });

  it('returns no access when user has neither direct nor link access', async () => {
    // First: direct membership → null
    // Second: team_links → empty (no links)
    setupMockClient([
      { data: null, error: null },
      { data: [], error: null },
    ]);

    const result = await hasTeamAccess('user-stranger', 'team-1');

    expect(result).toEqual({ access: false, role: 'member', via: 'direct' });
  });

  it('returns no access when links exist but user is not in any agency team', async () => {
    // First: direct membership → null
    // Second: team_links → returns agency IDs
    // Third: team_members check on agency team → null (not a member)
    setupMockClient([
      { data: null, error: null },
      { data: [{ agency_team_id: 'team-1' }], error: null },
      { data: null, error: null },
    ]);

    const result = await hasTeamAccess('user-stranger', 'team-2');

    expect(result).toEqual({ access: false, role: 'member', via: 'direct' });
  });
});

// ─── getUserTeams ───────────────────────────────────────────────────────────

describe('getUserTeams', () => {
  it('returns direct teams and linked teams, deduped', async () => {
    // Call 1: direct memberships (team_members → teams join)
    // Call 2: agency memberships (for link lookup)
    // Call 3: team_links → teams join
    setupMockClient([
      { data: [{ role: 'owner', teams: TEAM_1 }], error: null },
      { data: [{ team_id: 'team-1' }], error: null },
      { data: [{ client_team_id: 'team-2', teams: TEAM_2 }], error: null },
    ]);

    const result = await getUserTeams('user-owner');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ team: TEAM_1, role: 'owner', via: 'direct' });
    expect(result[1]).toEqual({ team: TEAM_2, role: 'member', via: 'team_link' });
  });

  it('deduplicates — prefers direct over linked', async () => {
    // User has direct membership to team-2 AND team-2 appears via link
    setupMockClient([
      {
        data: [
          { role: 'owner', teams: TEAM_1 },
          { role: 'member', teams: TEAM_2 },
        ],
        error: null,
      },
      { data: [{ team_id: 'team-1' }], error: null },
      { data: [{ client_team_id: 'team-2', teams: TEAM_2 }], error: null },
    ]);

    const result = await getUserTeams('user-owner');

    expect(result).toHaveLength(2);
    // team-2 should be direct, not team_link
    const team2Entry = result.find((r) => r.team.id === 'team-2');
    expect(team2Entry?.via).toBe('direct');
  });

  it('returns empty array when user has no memberships', async () => {
    setupMockClient([
      { data: [], error: null },
      { data: [], error: null },
    ]);

    const result = await getUserTeams('user-nobody');

    expect(result).toEqual([]);
  });

  it('throws on direct membership query error', async () => {
    setupMockClient([
      { data: null, error: { message: 'DB error' } },
    ]);

    await expect(getUserTeams('user-owner')).rejects.toThrow('team.getUserTeams direct');
  });
});

// ─── addMember ──────────────────────────────────────────────────────────────

describe('addMember', () => {
  it('inserts a team member and returns the row', async () => {
    setupMockClient([
      { data: MEMBER_1, error: null },
    ]);

    const result = await addMember('team-1', 'user-owner', 'owner');

    expect(result).toEqual(MEMBER_1);
    const client = (createSupabaseAdminClient as jest.Mock).mock.results[0].value;
    expect(client.from).toHaveBeenCalledWith('team_members');
  });

  it('throws on insert error', async () => {
    setupMockClient([
      { data: null, error: { message: 'Unique violation' } },
    ]);

    await expect(addMember('team-1', 'user-dup', 'member')).rejects.toThrow('team.addMember');
  });
});

// ─── removeMember ───────────────────────────────────────────────────────────

describe('removeMember', () => {
  it('sets status to removed', async () => {
    setupMockClient([
      { data: null, error: null },
    ]);

    await expect(removeMember('team-1', 'user-member')).resolves.toBeUndefined();
  });

  it('throws on update error', async () => {
    setupMockClient([
      { data: null, error: { message: 'Not found' } },
    ]);

    await expect(removeMember('team-1', 'user-ghost')).rejects.toThrow('team.removeMember');
  });
});

// ─── listMembers ────────────────────────────────────────────────────────────

describe('listMembers', () => {
  it('returns active members ordered by joined_at', async () => {
    const members = [MEMBER_1, { ...MEMBER_1, id: 'member-2', user_id: 'user-member', role: 'member' }];
    setupMockClient([
      { data: members, error: null },
    ]);

    // listMembers chain ends without single/maybeSingle — our mock resolves via .then
    // But actually, looking at the repo code, it doesn't call single() — the query
    // returns { data, error } from the chain's terminal order/eq calls.
    // Our mock handles this because all chain methods return the chain which has .then
    const result = await listMembers('team-1');

    expect(result).toEqual(members);
  });

  it('throws on query error', async () => {
    setupMockClient([
      { data: null, error: { message: 'Connection lost' } },
    ]);

    await expect(listMembers('team-1')).rejects.toThrow('team.listMembers');
  });
});

// ─── createTeamLink ─────────────────────────────────────────────────────────

describe('createTeamLink', () => {
  it('inserts a team link and returns it', async () => {
    setupMockClient([
      { data: LINK_1, error: null },
    ]);

    const result = await createTeamLink('team-1', 'team-2');

    expect(result).toEqual(LINK_1);
  });

  it('throws on duplicate link error', async () => {
    setupMockClient([
      { data: null, error: { message: 'Unique constraint violation' } },
    ]);

    await expect(createTeamLink('team-1', 'team-2')).rejects.toThrow('team.createTeamLink');
  });
});

// ─── deleteTeamLink ─────────────────────────────────────────────────────────

describe('deleteTeamLink', () => {
  it('deletes a team link by ID', async () => {
    setupMockClient([
      { data: null, error: null },
    ]);

    await expect(deleteTeamLink('link-1')).resolves.toBeUndefined();
  });

  it('throws on delete error', async () => {
    setupMockClient([
      { data: null, error: { message: 'FK constraint' } },
    ]);

    await expect(deleteTeamLink('link-bad')).rejects.toThrow('team.deleteTeamLink');
  });
});

// ─── listTeamLinks ──────────────────────────────────────────────────────────

describe('listTeamLinks', () => {
  it('returns links where team is agency or client', async () => {
    setupMockClient([
      { data: [LINK_1], error: null },
    ]);

    const result = await listTeamLinks('team-1');

    expect(result).toEqual([LINK_1]);
  });

  it('throws on query error', async () => {
    setupMockClient([
      { data: null, error: { message: 'query failed' } },
    ]);

    await expect(listTeamLinks('team-1')).rejects.toThrow('query failed');
  });
});

// ─── getTeamProfiles ────────────────────────────────────────────────────────

describe('getTeamProfiles', () => {
  it('returns active profiles for the team', async () => {
    setupMockClient([
      { data: [PROFILE_1], error: null },
    ]);

    const result = await getTeamProfiles('team-1');

    expect(result).toEqual([PROFILE_1]);
  });

  it('throws on query error', async () => {
    setupMockClient([
      { data: null, error: { message: 'Query failed' } },
    ]);

    await expect(getTeamProfiles('team-1')).rejects.toThrow('team.getTeamProfiles');
  });
});

// ─── getDefaultProfile ──────────────────────────────────────────────────────

describe('getDefaultProfile', () => {
  it('returns is_default=true profile', async () => {
    setupMockClient([
      { data: PROFILE_1, error: null },
    ]);

    const result = await getDefaultProfile('team-1');

    expect(result).toEqual(PROFILE_1);
  });

  it('returns null when no default profile exists', async () => {
    setupMockClient([
      { data: null, error: null },
    ]);

    const result = await getDefaultProfile('team-empty');

    expect(result).toBeNull();
  });
});

// ─── getTeamProfileIds ──────────────────────────────────────────────────────

describe('getTeamProfileIds', () => {
  it('returns string array of active profile IDs', async () => {
    setupMockClient([
      { data: [{ id: 'profile-1' }, { id: 'profile-2' }], error: null },
    ]);

    const result = await getTeamProfileIds('team-1');

    expect(result).toEqual(['profile-1', 'profile-2']);
  });

  it('returns empty array when no profiles exist', async () => {
    setupMockClient([
      { data: [], error: null },
    ]);

    const result = await getTeamProfileIds('team-empty');

    expect(result).toEqual([]);
  });
});
