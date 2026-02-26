/**
 * @jest-environment node
 */

import { resolveBrandKit } from '@/lib/api/resolve-brand-kit';

// Mock Supabase client
function createMockSupabase(
  overrides: {
    teamProfile?: { team_id: string } | null;
    teamBrandKit?: Record<string, unknown> | null;
    userBrandKit?: Record<string, unknown> | null;
    directTeamBrandKit?: Record<string, unknown> | null;
  } = {},
) {
  const { teamProfile = null, teamBrandKit = null, userBrandKit = null, directTeamBrandKit = null } = overrides;

  // Track which table + filters are being queried
  let currentTable = '';
  let currentFilters: Record<string, unknown> = {};

  const chainable = {
    select: () => chainable,
    eq: (col: string, val: unknown) => {
      currentFilters[col] = val;
      return chainable;
    },
    limit: () => chainable,
    single: () => {
      if (currentTable === 'team_profiles') {
        return { data: teamProfile, error: null };
      }
      if (currentTable === 'brand_kits') {
        // Direct team_id lookup
        if (currentFilters.team_id && !teamProfile) {
          return { data: directTeamBrandKit, error: null };
        }
        // Team-level brand kit
        if (currentFilters.team_id) {
          return { data: teamBrandKit, error: null };
        }
        // User-level brand kit
        if (currentFilters.user_id) {
          return { data: userBrandKit, error: null };
        }
      }
      return { data: null, error: null };
    },
  };

  return {
    from: (table: string) => {
      currentTable = table;
      currentFilters = {};
      return chainable;
    },
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe('resolveBrandKit', () => {
  const baseBrandKit = {
    default_theme: 'dark',
    default_primary_color: '#d4a84b',
    logo_url: 'https://example.com/logo.png',
    font_family: 'Cormorant Garamond',
  };

  it('returns team-level brand kit when team_profiles owner exists', async () => {
    const supabase = createMockSupabase({
      teamProfile: { team_id: 'team-1' },
      teamBrandKit: baseBrandKit,
    });

    const result = await resolveBrandKit(supabase, 'user-1');

    expect(result).toEqual(baseBrandKit);
  });

  it('falls back to user-level brand kit when no team kit exists', async () => {
    const userKit = { ...baseBrandKit, default_theme: 'light' };
    const supabase = createMockSupabase({
      teamProfile: null,
      userBrandKit: userKit,
    });

    const result = await resolveBrandKit(supabase, 'user-1');

    expect(result).toEqual(userKit);
  });

  it('returns null when no brand kit exists', async () => {
    const supabase = createMockSupabase({});

    const result = await resolveBrandKit(supabase, 'user-1');

    expect(result).toBeNull();
  });

  it('uses direct teamId when provided', async () => {
    const supabase = createMockSupabase({
      directTeamBrandKit: baseBrandKit,
    });

    const result = await resolveBrandKit(supabase, 'user-1', 'direct-team-id');

    expect(result).toEqual(baseBrandKit);
  });

  it('falls back to team_profiles lookup when direct teamId brand kit is null', async () => {
    const userKit = { ...baseBrandKit, default_primary_color: '#ff0000' };
    const supabase = createMockSupabase({
      teamProfile: null,
      directTeamBrandKit: null,
      userBrandKit: userKit,
    });

    const result = await resolveBrandKit(supabase, 'user-1', 'no-kit-team');

    expect(result).toEqual(userKit);
  });
});
