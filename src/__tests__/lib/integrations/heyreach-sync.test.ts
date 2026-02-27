/**
 * @jest-environment node
 */

// ============================================
// Chainable Supabase mock
// ============================================

const mockSingle = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockUpdate = jest.fn();
const mockFrom = jest.fn();

function wireChainMocks() {
  mockFrom.mockReturnValue({
    select: mockSelect,
    update: mockUpdate,
  });
  mockSelect.mockReturnValue({ eq: mockEq });
  mockUpdate.mockReturnValue({ eq: mockEq });
  mockEq.mockReturnValue({ eq: mockEq, single: mockSingle });
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

const mockAddContactsToCampaign = jest.fn();

jest.mock('@/lib/integrations/heyreach/client', () => ({
  HeyReachClient: jest.fn().mockImplementation(() => ({
    addContactsToCampaign: mockAddContactsToCampaign,
  })),
}));

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { syncLeadToHeyReach } from '@/lib/integrations/heyreach/sync';
import { HeyReachClient } from '@/lib/integrations/heyreach/client';
import type { HeyReachSyncParams } from '@/lib/integrations/heyreach/types';

const mockGetUserIntegration = getUserIntegration as jest.MockedFunction<typeof getUserIntegration>;

// ============================================
// Test helpers
// ============================================

function makeParams(overrides: Partial<HeyReachSyncParams> = {}): HeyReachSyncParams {
  return {
    userId: 'user-123',
    funnelPageId: 'funnel-456',
    lead: {
      email: 'jane@example.com',
      name: 'Jane Smith',
      linkedinUrl: 'https://linkedin.com/in/janesmith',
    },
    leadMagnetTitle: 'Growth Playbook',
    leadMagnetUrl: 'https://magnetlab.app/p/user/growth-playbook/content',
    funnelSlug: 'growth-playbook',
    ...overrides,
  };
}

function mockActiveIntegration() {
  mockGetUserIntegration.mockResolvedValue({
    id: 'int-1',
    user_id: 'user-123',
    service: 'heyreach',
    api_key: 'hr-api-key-123',
    webhook_secret: null,
    is_active: true,
    last_verified_at: null,
    metadata: {},
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  });
}

function mockActiveFunnelIntegration(campaignId: number | null = 99) {
  const settings = campaignId !== null ? { campaign_id: campaignId } : {};
  mockSingle.mockResolvedValueOnce({
    data: {
      id: 'fi-1',
      funnel_page_id: 'funnel-456',
      provider: 'heyreach',
      is_active: true,
      settings,
    },
    error: null,
  });
}

// ============================================
// Tests
// ============================================

describe('syncLeadToHeyReach', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    wireChainMocks();
  });

  // 1. Skips silently when no integration configured
  it('skips silently when getUserIntegration returns null', async () => {
    mockGetUserIntegration.mockResolvedValue(null);

    await syncLeadToHeyReach(makeParams());

    expect(mockGetUserIntegration).toHaveBeenCalledWith('user-123', 'heyreach');
    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockAddContactsToCampaign).not.toHaveBeenCalled();
  });

  // 2. Skips when integration is inactive
  it('skips when integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'heyreach',
      api_key: 'hr-api-key-123',
      webhook_secret: null,
      is_active: false,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    await syncLeadToHeyReach(makeParams());

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockAddContactsToCampaign).not.toHaveBeenCalled();
  });

  // 3. Skips when funnel integration not found
  it('skips when funnel integration not found', async () => {
    mockActiveIntegration();
    mockSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'Not found', code: 'PGRST116' },
    });

    await syncLeadToHeyReach(makeParams());

    expect(mockFrom).toHaveBeenCalledWith('funnel_integrations');
    expect(mockAddContactsToCampaign).not.toHaveBeenCalled();
  });

  // 4. Skips when no campaign_id in settings
  it('skips when no campaign_id in settings', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(null);

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
    await syncLeadToHeyReach(makeParams());

    expect(mockAddContactsToCampaign).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      '[HeyReach sync] No campaign_id configured for funnel',
      'funnel-456'
    );
    consoleSpy.mockRestore();
  });

  // 5. Delivers lead to HeyReach campaign with correct custom fields
  it('delivers lead to HeyReach campaign with correct custom fields', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(99);
    mockAddContactsToCampaign.mockResolvedValue({ success: true, added: 1 });
    // Mock the update chain for delivery status
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, catch: jest.fn() });

    await syncLeadToHeyReach(
      makeParams({
        lead: {
          email: 'jane@example.com',
          name: 'Jane Smith',
          linkedinUrl: 'https://linkedin.com/in/janesmith',
          utmSource: 'linkedin',
          utmMedium: 'social',
          utmCampaign: 'q1-launch',
        },
      })
    );

    expect(HeyReachClient).toHaveBeenCalledWith('hr-api-key-123');
    expect(mockAddContactsToCampaign).toHaveBeenCalledWith(99, [
      {
        linkedinUrl: 'https://linkedin.com/in/janesmith',
        firstName: 'Jane',
        lastName: 'Smith',
        email: 'jane@example.com',
        customFields: {
          lead_magnet_title: 'Growth Playbook',
          lead_magnet_url: 'https://magnetlab.app/p/user/growth-playbook/content',
          utm_source: 'linkedin',
          utm_medium: 'social',
          utm_campaign: 'q1-launch',
        },
      },
    ]);
  });

  // 6. Never throws (fire-and-forget)
  it('never throws even when getUserIntegration throws', async () => {
    mockGetUserIntegration.mockRejectedValue(new Error('Database down'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    // Should NOT throw
    await expect(syncLeadToHeyReach(makeParams())).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HeyReach sync] Unexpected error:',
      'Database down'
    );
    consoleSpy.mockRestore();
  });

  it('never throws when addContactsToCampaign throws', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(99);
    mockAddContactsToCampaign.mockRejectedValue(new Error('Network timeout'));

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await expect(syncLeadToHeyReach(makeParams())).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HeyReach sync] Unexpected error:',
      'Network timeout'
    );
    consoleSpy.mockRestore();
  });

  // 7. Updates heyreach_delivery_status to 'sent' on success
  it('updates heyreach_delivery_status to sent on success', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(99);
    mockAddContactsToCampaign.mockResolvedValue({ success: true, added: 1 });

    // Track update calls
    const catchFn = jest.fn().mockResolvedValue(undefined);
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, catch: catchFn });

    await syncLeadToHeyReach(makeParams());

    // Verify update was called with 'sent'
    expect(mockFrom).toHaveBeenCalledWith('funnel_leads');
    expect(mockUpdate).toHaveBeenCalledWith({ heyreach_delivery_status: 'sent' });
  });

  // 8. Updates heyreach_delivery_status to 'failed' on failure
  it('updates heyreach_delivery_status to failed on failure', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(99);
    mockAddContactsToCampaign.mockResolvedValue({
      success: false,
      added: 0,
      error: 'HTTP 400: Bad request',
    });

    const catchFn = jest.fn().mockResolvedValue(undefined);
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, catch: catchFn });

    const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

    await syncLeadToHeyReach(makeParams());

    // Verify update was called with 'failed'
    expect(mockFrom).toHaveBeenCalledWith('funnel_leads');
    expect(mockUpdate).toHaveBeenCalledWith({ heyreach_delivery_status: 'failed' });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[HeyReach sync] addContactsToCampaign failed:',
      'HTTP 400: Bad request'
    );
    consoleSpy.mockRestore();
  });

  // Additional: handles name splitting correctly
  it('splits multi-part last names correctly', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(99);
    mockAddContactsToCampaign.mockResolvedValue({ success: true, added: 1 });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, catch: jest.fn() });

    await syncLeadToHeyReach(
      makeParams({
        lead: {
          email: 'anna@example.com',
          name: 'Anna Maria Von Trapp',
        },
      })
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledWith(99, [
      expect.objectContaining({
        firstName: 'Anna',
        lastName: 'Maria Von Trapp',
        email: 'anna@example.com',
        linkedinUrl: undefined,
      }),
    ]);
  });

  it('handles lead with no name', async () => {
    mockActiveIntegration();
    mockActiveFunnelIntegration(99);
    mockAddContactsToCampaign.mockResolvedValue({ success: true, added: 1 });
    mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, catch: jest.fn() });

    await syncLeadToHeyReach(
      makeParams({
        lead: {
          email: 'noname@example.com',
          name: null,
        },
      })
    );

    expect(mockAddContactsToCampaign).toHaveBeenCalledWith(99, [
      expect.objectContaining({
        firstName: '',
        lastName: '',
        email: 'noname@example.com',
      }),
    ]);
  });

  it('skips when integration has no api_key', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'heyreach',
      api_key: null,
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01',
      updated_at: '2026-01-01',
    });

    await syncLeadToHeyReach(makeParams());

    expect(mockFrom).not.toHaveBeenCalled();
    expect(mockAddContactsToCampaign).not.toHaveBeenCalled();
  });

  it('skips when funnel integration is_active is false', async () => {
    mockActiveIntegration();
    mockSingle.mockResolvedValueOnce({
      data: {
        id: 'fi-1',
        funnel_page_id: 'funnel-456',
        provider: 'heyreach',
        is_active: false,
        settings: { campaign_id: 99 },
      },
      error: null,
    });

    await syncLeadToHeyReach(makeParams());

    expect(mockAddContactsToCampaign).not.toHaveBeenCalled();
  });
});
