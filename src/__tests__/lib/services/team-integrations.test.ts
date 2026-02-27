/**
 * @jest-environment node
 */

// ============================================
// Chainable Supabase mock
// ============================================

const mockSingle = jest.fn();
const mockIn = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpsert = jest.fn();
const mockFrom = jest.fn();

// Default chaining setup
function wireChainMocks() {
  mockFrom.mockReturnValue({
    select: mockSelect,
    upsert: mockUpsert,
  });
  // select() returns { eq, single } — single needed for upsert().select('*').single()
  mockSelect.mockReturnValue({ eq: mockEq, single: mockSingle });
  mockUpsert.mockReturnValue({ select: mockSelect });
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, in: mockIn });
  mockIn.mockReturnValue({ eq: mockEq, single: mockSingle });
  mockSingle.mockResolvedValue({ data: null, error: null });
}

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({
    from: mockFrom,
  }),
}));

jest.mock('@/lib/utils/encrypted-storage', () => ({
  getUserIntegration: jest.fn(),
}));

jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: jest.fn(),
  isUnipileConfigured: jest.fn(),
  UnipileClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { isUnipileConfigured, getUnipileClient } from '@/lib/integrations/unipile';
import {
  getTeamProfileUnipileAccountId,
  getTeamProfilesWithConnections,
  connectTeamProfileLinkedIn,
  getTeamProfileLinkedInPublisher,
} from '@/lib/services/team-integrations';

const mockGetUserIntegration = getUserIntegration as jest.MockedFunction<typeof getUserIntegration>;
const mockIsUnipileConfigured = isUnipileConfigured as jest.MockedFunction<typeof isUnipileConfigured>;
const mockGetUnipileClient = getUnipileClient as jest.MockedFunction<typeof getUnipileClient>;

describe('team-integrations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireChainMocks();
  });

  // ----------------------------------------------------------------
  // getTeamProfileUnipileAccountId
  // ----------------------------------------------------------------
  describe('getTeamProfileUnipileAccountId', () => {
    it('returns account ID from team_profile_integrations when active', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          metadata: { unipile_account_id: 'acct-from-team' },
          is_active: true,
        },
        error: null,
      });

      const result = await getTeamProfileUnipileAccountId('profile-1');

      expect(result).toBe('acct-from-team');
      expect(mockFrom).toHaveBeenCalledWith('team_profile_integrations');
    });

    it('returns null when no team integration exists and no user_id on profile', async () => {
      // team_profile_integrations: no rows
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows' },
      });

      // team_profiles: profile with no user_id
      mockSingle.mockResolvedValueOnce({
        data: { user_id: null },
        error: null,
      });

      const result = await getTeamProfileUnipileAccountId('profile-no-user');

      expect(result).toBeNull();
    });

    it('returns null when no team integration and no user integration exists', async () => {
      // team_profile_integrations: no rows
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'No rows' },
      });

      // team_profiles: has user_id
      mockSingle.mockResolvedValueOnce({
        data: { user_id: 'user-123' },
        error: null,
      });

      // user_integrations fallback: no integration
      mockGetUserIntegration.mockResolvedValueOnce(null);

      const result = await getTeamProfileUnipileAccountId('profile-2');

      expect(result).toBeNull();
      expect(mockGetUserIntegration).toHaveBeenCalledWith('user-123', 'unipile');
    });

    it('falls back to user_integrations when team integration is inactive', async () => {
      // team_profile_integrations: exists but inactive
      mockSingle.mockResolvedValueOnce({
        data: {
          metadata: { unipile_account_id: 'acct-team-inactive' },
          is_active: false,
        },
        error: null,
      });

      // team_profiles: has user_id
      mockSingle.mockResolvedValueOnce({
        data: { user_id: 'user-456' },
        error: null,
      });

      // user_integrations: active with account ID
      mockGetUserIntegration.mockResolvedValueOnce({
        id: 'int-1',
        user_id: 'user-456',
        service: 'unipile',
        api_key: null,
        webhook_secret: null,
        is_active: true,
        last_verified_at: null,
        metadata: { unipile_account_id: 'acct-from-user' },
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      });

      const result = await getTeamProfileUnipileAccountId('profile-3');

      expect(result).toBe('acct-from-user');
    });

    it('returns null when team integration has no account_id in metadata', async () => {
      mockSingle.mockResolvedValueOnce({
        data: {
          metadata: {},
          is_active: true,
        },
        error: null,
      });

      // Falls through to team_profiles: no user_id
      mockSingle.mockResolvedValueOnce({
        data: { user_id: null },
        error: null,
      });

      const result = await getTeamProfileUnipileAccountId('profile-4');

      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // getTeamProfilesWithConnections
  // ----------------------------------------------------------------
  describe('getTeamProfilesWithConnections', () => {
    const baseProfile = {
      id: 'prof-1',
      team_id: 'team-1',
      user_id: 'user-1',
      email: 'alice@test.com',
      full_name: 'Alice',
      title: null,
      linkedin_url: null,
      bio: null,
      expertise_areas: [],
      voice_profile: {},
      avatar_url: null,
      role: 'member',
      status: 'active',
      is_default: false,
      invited_at: null,
      accepted_at: null,
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    };

    it('enriches profiles with connection status from team integrations', async () => {
      const profiles = [
        { ...baseProfile, id: 'prof-1', user_id: 'user-1' },
        { ...baseProfile, id: 'prof-2', user_id: 'user-2' },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'team_profiles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: profiles, error: null }),
              }),
            }),
          };
        }
        if (table === 'team_profile_integrations') {
          return {
            select: () => ({
              in: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        team_profile_id: 'prof-1',
                        metadata: { unipile_account_id: 'acct-team-1' },
                        is_active: true,
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        if (table === 'user_integrations') {
          return {
            select: () => ({
              in: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [
                      {
                        user_id: 'user-2',
                        metadata: { unipile_account_id: 'acct-user-2' },
                        is_active: true,
                      },
                    ],
                    error: null,
                  }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const result = await getTeamProfilesWithConnections('team-1');

      expect(result).toHaveLength(2);

      const prof1 = result.find((p) => p.id === 'prof-1');
      expect(prof1?.linkedin_connected).toBe(true);
      expect(prof1?.unipile_account_id).toBe('acct-team-1');

      const prof2 = result.find((p) => p.id === 'prof-2');
      expect(prof2?.linkedin_connected).toBe(true);
      expect(prof2?.unipile_account_id).toBe('acct-user-2');
    });

    it('returns empty array when no active profiles exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'team_profiles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const result = await getTeamProfilesWithConnections('team-empty');

      expect(result).toEqual([]);
    });

    it('marks profiles without any integration as not connected', async () => {
      const profiles = [
        { ...baseProfile, id: 'prof-alone', user_id: null },
      ];

      mockFrom.mockImplementation((table: string) => {
        if (table === 'team_profiles') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: profiles, error: null }),
              }),
            }),
          };
        }
        if (table === 'team_profile_integrations') {
          return {
            select: () => ({
              in: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        return { select: mockSelect };
      });

      const result = await getTeamProfilesWithConnections('team-1');

      expect(result).toHaveLength(1);
      expect(result[0].linkedin_connected).toBe(false);
      expect(result[0].unipile_account_id).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // connectTeamProfileLinkedIn
  // ----------------------------------------------------------------
  describe('connectTeamProfileLinkedIn', () => {
    it('upserts into team_profile_integrations and returns the record', async () => {
      const mockRecord = {
        id: 'tpi-1',
        team_profile_id: 'profile-1',
        service: 'unipile',
        is_active: true,
        metadata: { unipile_account_id: 'acct-new' },
        connected_by: 'user-owner',
        created_at: '2026-01-01T00:00:00Z',
        updated_at: '2026-01-01T00:00:00Z',
      };

      mockSingle.mockResolvedValueOnce({ data: mockRecord, error: null });

      const result = await connectTeamProfileLinkedIn(
        'profile-1',
        'acct-new',
        'user-owner'
      );

      expect(result).toEqual(mockRecord);
      expect(mockFrom).toHaveBeenCalledWith('team_profile_integrations');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          team_profile_id: 'profile-1',
          service: 'unipile',
          is_active: true,
          metadata: { unipile_account_id: 'acct-new' },
          connected_by: 'user-owner',
        }),
        { onConflict: 'team_profile_id,service' }
      );
    });

    it('returns null on upsert error', async () => {
      mockSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'constraint violation' },
      });

      const result = await connectTeamProfileLinkedIn(
        'profile-bad',
        'acct-x',
        'user-owner'
      );

      expect(result).toBeNull();
    });
  });

  // ----------------------------------------------------------------
  // getTeamProfileLinkedInPublisher
  // ----------------------------------------------------------------
  describe('getTeamProfileLinkedInPublisher', () => {
    it('returns null when Unipile is not configured', async () => {
      mockIsUnipileConfigured.mockReturnValue(false);

      const result = await getTeamProfileLinkedInPublisher('profile-1');

      expect(result).toBeNull();
    });

    it('returns null when no account ID is found', async () => {
      mockIsUnipileConfigured.mockReturnValue(true);

      // getTeamProfileUnipileAccountId is called internally.
      // It calls from('team_profile_integrations')...single() then from('team_profiles')...single()
      // First .single() call: team_profile_integrations — no rows
      mockSingle
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116', message: 'No rows' },
        })
        // Second .single() call: team_profiles — no user_id
        .mockResolvedValueOnce({
          data: { user_id: null },
          error: null,
        });

      const result = await getTeamProfileLinkedInPublisher('profile-no-acct');

      expect(result).toBeNull();
    });

    it('returns a publisher with publishNow and getPostStats when connected', async () => {
      mockIsUnipileConfigured.mockReturnValue(true);

      // getTeamProfileUnipileAccountId: team_profile_integrations has active account
      mockSingle.mockResolvedValueOnce({
        data: {
          metadata: { unipile_account_id: 'acct-pub' },
          is_active: true,
        },
        error: null,
      });

      const mockCreatePost = jest.fn().mockResolvedValue({
        data: {
          id: 'post-1',
          social_id: 'urn:li:activity:123',
          account_id: 'acct-pub',
          provider: 'LINKEDIN',
          text: 'Hello',
          created_at: '2026-01-01',
        },
        error: null,
        status: 200,
      });
      const mockGetPost = jest.fn().mockResolvedValue({
        data: {
          id: 'post-1',
          social_id: 'urn:li:activity:123',
          likes_count: 10,
          comments_count: 2,
          shares_count: 1,
        },
        error: null,
        status: 200,
      });

      mockGetUnipileClient.mockReturnValue({
        createPost: mockCreatePost,
        getPost: mockGetPost,
      } as unknown as ReturnType<typeof getUnipileClient>);

      const publisher = await getTeamProfileLinkedInPublisher('profile-pub');

      expect(publisher).not.toBeNull();
      expect(publisher).toHaveProperty('publishNow');
      expect(publisher).toHaveProperty('getPostStats');

      // Test publishNow
      const post = await publisher!.publishNow('Hello world');
      expect(post).not.toBeNull();
      expect(mockCreatePost).toHaveBeenCalledWith('acct-pub', 'Hello world');

      // Test getPostStats
      const stats = await publisher!.getPostStats('post-1');
      expect(stats).not.toBeNull();
      expect(stats?.likes_count).toBe(10);
      expect(mockGetPost).toHaveBeenCalledWith('post-1', 'acct-pub');
    });
  });
});
