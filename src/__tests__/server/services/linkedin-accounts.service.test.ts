/**
 * Tests for linkedin-accounts.service — account access validation and listing.
 * Mocks Supabase admin client and Unipile client.
 *
 * @jest-environment node
 */

// ─── Mocks (before imports) ──────────────────────────────────────────────────

// Chainable Supabase mock
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockSelect = jest.fn();
const mockFrom = jest.fn();

function wireChainMocks() {
  mockFrom.mockReturnValue({ select: mockSelect });
  mockSelect.mockReturnValue({ eq: mockEq, in: mockIn });
  mockEq.mockReturnValue({ eq: mockEq, in: mockIn });
  mockIn.mockReturnValue({ eq: mockEq });
  // Default: return empty arrays
  mockEq.mockResolvedValue({ data: [], error: null });
  mockIn.mockReturnValue({ eq: mockEq });
}

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => ({ from: mockFrom }),
}));

const mockListAccounts = jest.fn();
jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: jest.fn(() => ({ listAccounts: mockListAccounts })),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import {
  validateUnipileAccountAccess,
  listLinkedInAccounts,
} from '@/server/services/linkedin-accounts.service';
import { logError } from '@/lib/utils/logger';
import { getUnipileClient } from '@/lib/integrations/unipile';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const USER_ID = 'user-abc';
const ACCOUNT_ID = 'acct-123';
const TEAM_ID = 'team-xyz';

const makeUserIntegration = (accountId: string) => ({
  id: 'int-1',
  metadata: { unipile_account_id: accountId },
});

const makeTeamIntegration = (accountId: string) => ({
  id: 'tpi-1',
  metadata: { unipile_account_id: accountId },
});

// ─── validateUnipileAccountAccess ────────────────────────────────────────────

describe('validateUnipileAccountAccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireChainMocks();
  });

  it('returns true when account found in user_integrations', async () => {
    // user_integrations query returns matching row
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [makeUserIntegration(ACCOUNT_ID)], error: null }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    const result = await validateUnipileAccountAccess(USER_ID, ACCOUNT_ID);

    expect(result).toBe(true);
  });

  it('returns false when account not found in user_integrations or team_profile_integrations', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeUserIntegration('acct-different')],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === 'team_profiles') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      return { select: mockSelect };
    });

    const result = await validateUnipileAccountAccess(USER_ID, ACCOUNT_ID);

    expect(result).toBe(false);
  });

  it('checks team_profile_integrations when user_integrations has no match', async () => {
    const profileId = 'profile-1';

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        };
      }
      if (table === 'team_profiles') {
        return {
          select: () => ({
            eq: () => Promise.resolve({ data: [{ id: profileId }], error: null }),
          }),
        };
      }
      if (table === 'team_profile_integrations') {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeTeamIntegration(ACCOUNT_ID)],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    const result = await validateUnipileAccountAccess(USER_ID, ACCOUNT_ID);

    expect(result).toBe(true);
    expect(mockFrom).toHaveBeenCalledWith('team_profile_integrations');
  });
});

// ─── listLinkedInAccounts ─────────────────────────────────────────────────────

describe('listLinkedInAccounts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireChainMocks();
  });

  it('returns accounts from user_integrations', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeUserIntegration('acct-user-1')],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    const result = await listLinkedInAccounts(USER_ID);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      unipile_account_id: 'acct-user-1',
      source: 'user',
      name: null,
      status: null,
    });
  });

  it('includes team_profile_integrations accounts when teamId provided', async () => {
    const profileId = 'profile-1';

    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeUserIntegration('acct-user-1')],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      if (table === 'team_profiles') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => Promise.resolve({ data: [{ id: profileId }], error: null }),
            }),
          }),
        };
      }
      if (table === 'team_profile_integrations') {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeTeamIntegration('acct-team-1')],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    const result = await listLinkedInAccounts(USER_ID, TEAM_ID);

    expect(result).toHaveLength(2);
    expect(result.find((a) => a.source === 'user')?.unipile_account_id).toBe('acct-user-1');
    expect(result.find((a) => a.source === 'team')?.unipile_account_id).toBe('acct-team-1');
  });

  it('enriches accounts from Unipile API when refresh=true', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeUserIntegration('acct-user-1')],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    mockListAccounts.mockResolvedValue({
      data: {
        items: [{ id: 'acct-user-1', name: 'Alice LinkedIn', status: 'OK' }],
      },
      error: null,
      status: 200,
    });

    const result = await listLinkedInAccounts(USER_ID, undefined, true);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      unipile_account_id: 'acct-user-1',
      name: 'Alice LinkedIn',
      status: 'OK',
      source: 'user',
    });
    expect(getUnipileClient).toHaveBeenCalled();
    expect(mockListAccounts).toHaveBeenCalled();
  });

  it('returns cached data gracefully when Unipile enrichment fails', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'user_integrations') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [makeUserIntegration('acct-user-1')],
                    error: null,
                  }),
              }),
            }),
          }),
        };
      }
      return { select: mockSelect };
    });

    mockListAccounts.mockRejectedValue(new Error('Unipile API unavailable'));

    const result = await listLinkedInAccounts(USER_ID, undefined, true);

    // Should still return the account, just without enrichment
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      unipile_account_id: 'acct-user-1',
      name: null,
      status: null,
    });
    expect(logError).toHaveBeenCalledWith(
      'linkedin-accounts/list/unipile-enrichment',
      expect.any(Error),
      expect.objectContaining({ userId: USER_ID })
    );
  });
});
