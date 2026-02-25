/**
 * @jest-environment node
 */

import type { GHLSyncParams } from '../types';

// Mock dependencies before importing the module under test
jest.mock('@/lib/utils/encrypted-storage');
jest.mock('@/lib/utils/supabase-server');
jest.mock('../client');

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { GoHighLevelClient } from '../client';
import { syncLeadToGoHighLevel } from '../sync';

const mockGetUserIntegration = getUserIntegration as jest.MockedFunction<typeof getUserIntegration>;
const MockGoHighLevelClient = GoHighLevelClient as jest.MockedClass<typeof GoHighLevelClient>;

// Supabase chain mock helpers
function createSupabaseMock(singleResult: { data: unknown; error: unknown }) {
  const mockSingle = jest.fn().mockResolvedValue(singleResult);
  const mockEq2 = jest.fn().mockReturnValue({ single: mockSingle });
  const mockEq1 = jest.fn().mockReturnValue({ eq: mockEq2 });
  const mockSelect = jest.fn().mockReturnValue({ eq: mockEq1 });
  const mockFrom = jest.fn().mockReturnValue({ select: mockSelect });
  const mockSupabase = { from: mockFrom };

  (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockSupabase);

  return { mockSupabase, mockFrom, mockSelect, mockEq1, mockEq2, mockSingle };
}

const baseSyncParams: GHLSyncParams = {
  userId: 'user-123',
  funnelPageId: 'funnel-page-456',
  lead: {
    email: 'jane@example.com',
    name: 'Jane Doe',
    utmSource: 'linkedin',
    utmMedium: 'social',
    utmCampaign: 'spring2026',
    isQualified: true,
    qualificationAnswers: { budget: '10k+', timeline: 'Q2' },
  },
  leadMagnetTitle: 'Agency Growth Guide',
  funnelSlug: 'agency-growth',
};

describe('syncLeadToGoHighLevel', () => {
  let mockCreateContact: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up GoHighLevelClient mock
    mockCreateContact = jest.fn().mockResolvedValue({ success: true, contactId: 'ghl-c-1' });
    MockGoHighLevelClient.mockImplementation(() => ({
      testConnection: jest.fn(),
      createContact: mockCreateContact,
    }) as unknown as GoHighLevelClient);
  });

  it('does nothing if user has no GHL integration', async () => {
    mockGetUserIntegration.mockResolvedValue(null);

    await syncLeadToGoHighLevel(baseSyncParams);

    expect(mockGetUserIntegration).toHaveBeenCalledWith('user-123', 'gohighlevel');
    expect(MockGoHighLevelClient).not.toHaveBeenCalled();
  });

  it('does nothing if GHL integration has no API key', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: null,
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    await syncLeadToGoHighLevel(baseSyncParams);

    expect(MockGoHighLevelClient).not.toHaveBeenCalled();
  });

  it('does nothing if GHL integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: false,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    await syncLeadToGoHighLevel(baseSyncParams);

    expect(MockGoHighLevelClient).not.toHaveBeenCalled();
  });

  it('does nothing if funnel has no GHL integration row (supabase returns null)', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({ data: null, error: { code: 'PGRST116', message: 'No rows' } });

    await syncLeadToGoHighLevel(baseSyncParams);

    expect(MockGoHighLevelClient).not.toHaveBeenCalled();
  });

  it('does nothing if funnel GHL integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: {
        id: 'fi-1',
        funnel_page_id: 'funnel-page-456',
        provider: 'gohighlevel',
        is_active: false,
        settings: {},
      },
      error: null,
    });

    await syncLeadToGoHighLevel(baseSyncParams);

    expect(MockGoHighLevelClient).not.toHaveBeenCalled();
  });

  it('creates contact with correct tags and customFields when funnel integration is active', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: {
        id: 'fi-1',
        funnel_page_id: 'funnel-page-456',
        provider: 'gohighlevel',
        is_active: true,
        settings: {
          custom_tags: ['vip', 'linkedin-lead'],
        },
      },
      error: null,
    });

    await syncLeadToGoHighLevel(baseSyncParams);

    // GoHighLevelClient instantiated with correct API key
    expect(MockGoHighLevelClient).toHaveBeenCalledWith('ghl-key-abc');

    // createContact called with correct payload
    expect(mockCreateContact).toHaveBeenCalledTimes(1);
    const payload = mockCreateContact.mock.calls[0][0];

    expect(payload.email).toBe('jane@example.com');
    expect(payload.name).toBe('Jane Doe');
    expect(payload.source).toBe('magnetlab');

    // Tags should include leadMagnetTitle, funnelSlug, 'magnetlab', and custom_tags
    expect(payload.tags).toEqual(
      expect.arrayContaining([
        'Agency Growth Guide',
        'agency-growth',
        'magnetlab',
        'vip',
        'linkedin-lead',
      ])
    );
    expect(payload.tags).toHaveLength(5);

    // customField should include UTM data and qualification
    expect(payload.customField).toEqual(
      expect.objectContaining({
        utm_source: 'linkedin',
        utm_medium: 'social',
        utm_campaign: 'spring2026',
        qualified: 'true',
      })
    );
  });

  it('creates contact without custom_tags when settings has none', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: {
        id: 'fi-1',
        funnel_page_id: 'funnel-page-456',
        provider: 'gohighlevel',
        is_active: true,
        settings: {},
      },
      error: null,
    });

    await syncLeadToGoHighLevel(baseSyncParams);

    const payload = mockCreateContact.mock.calls[0][0];
    expect(payload.tags).toEqual(['Agency Growth Guide', 'agency-growth', 'magnetlab']);
  });

  it('handles null/missing UTM and qualification fields gracefully', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: {
        id: 'fi-1',
        funnel_page_id: 'funnel-page-456',
        provider: 'gohighlevel',
        is_active: true,
        settings: {},
      },
      error: null,
    });

    const paramsNoUtm: GHLSyncParams = {
      ...baseSyncParams,
      lead: {
        email: 'jane@example.com',
        name: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        isQualified: null,
        qualificationAnswers: null,
      },
    };

    await syncLeadToGoHighLevel(paramsNoUtm);

    const payload = mockCreateContact.mock.calls[0][0];
    expect(payload.name).toBeUndefined();
    // customField should not include null UTM values
    expect(payload.customField).not.toHaveProperty('utm_source');
    expect(payload.customField).not.toHaveProperty('utm_medium');
    expect(payload.customField).not.toHaveProperty('utm_campaign');
    expect(payload.customField).not.toHaveProperty('qualified');
  });

  it('does not throw when createContact fails — fire-and-forget', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'gohighlevel',
      api_key: 'ghl-key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: {
        id: 'fi-1',
        funnel_page_id: 'funnel-page-456',
        provider: 'gohighlevel',
        is_active: true,
        settings: {},
      },
      error: null,
    });

    mockCreateContact.mockRejectedValue(new Error('Network failure'));

    // Should not throw
    await expect(syncLeadToGoHighLevel(baseSyncParams)).resolves.toBeUndefined();
  });

  it('does not throw when getUserIntegration throws', async () => {
    mockGetUserIntegration.mockRejectedValue(new Error('DB connection lost'));

    await expect(syncLeadToGoHighLevel(baseSyncParams)).resolves.toBeUndefined();
  });
});
