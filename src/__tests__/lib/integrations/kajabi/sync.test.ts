/**
 * @jest-environment node
 */

import type { KajabiSyncParams } from '@/lib/integrations/kajabi/types';

// Mock dependencies before importing the module under test
jest.mock('@/lib/utils/encrypted-storage');
jest.mock('@/lib/utils/supabase-server');
jest.mock('@/lib/integrations/kajabi/client');

import { getUserIntegration } from '@/lib/utils/encrypted-storage';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { KajabiClient } from '@/lib/integrations/kajabi/client';
import { syncLeadToKajabi } from '@/lib/integrations/kajabi/sync';

const mockGetUserIntegration = getUserIntegration as jest.MockedFunction<typeof getUserIntegration>;
const MockKajabiClient = KajabiClient as jest.MockedClass<typeof KajabiClient>;

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

const baseSyncParams: KajabiSyncParams = {
  userId: 'user-123',
  funnelPageId: 'funnel-page-456',
  lead: {
    email: 'jane@example.com',
    name: 'Jane Doe',
  },
};

describe('syncLeadToKajabi', () => {
  let mockCreateContact: jest.Mock;
  let mockAddTagsToContact: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up KajabiClient mock
    mockCreateContact = jest.fn().mockResolvedValue({ id: 'contact-123' });
    mockAddTagsToContact = jest.fn().mockResolvedValue(undefined);
    MockKajabiClient.mockImplementation(() => ({
      testConnection: jest.fn(),
      createContact: mockCreateContact,
      addTagsToContact: mockAddTagsToContact,
      listTags: jest.fn(),
    }) as unknown as KajabiClient);
  });

  it('skips when no integration exists', async () => {
    mockGetUserIntegration.mockResolvedValue(null);

    await syncLeadToKajabi(baseSyncParams);

    expect(mockGetUserIntegration).toHaveBeenCalledWith('user-123', 'kajabi');
    expect(MockKajabiClient).not.toHaveBeenCalled();
  });

  it('skips when integration has no API key', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: null,
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    await syncLeadToKajabi(baseSyncParams);

    expect(MockKajabiClient).not.toHaveBeenCalled();
  });

  it('skips when integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: false,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    await syncLeadToKajabi(baseSyncParams);

    expect(MockKajabiClient).not.toHaveBeenCalled();
  });

  it('skips when integration has no site_id in metadata', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: {},
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    await syncLeadToKajabi(baseSyncParams);

    expect(MockKajabiClient).not.toHaveBeenCalled();
  });

  it('skips when funnel integration row not found', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({ data: null, error: { code: 'PGRST116', message: 'No rows' } });

    await syncLeadToKajabi(baseSyncParams);

    expect(MockKajabiClient).not.toHaveBeenCalled();
  });

  it('skips when funnel integration is inactive', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: { id: 'fi-1', is_active: false, settings: {} },
      error: null,
    });

    await syncLeadToKajabi(baseSyncParams);

    expect(MockKajabiClient).not.toHaveBeenCalled();
  });

  it('creates contact and adds tags on success', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: { id: 'fi-1', is_active: true, settings: { tag_ids: ['tag-1', 'tag-2'] } },
      error: null,
    });

    await syncLeadToKajabi(baseSyncParams);

    // KajabiClient instantiated with correct API key and siteId
    expect(MockKajabiClient).toHaveBeenCalledWith('key-abc', 'site-1');

    // createContact called with correct args
    expect(mockCreateContact).toHaveBeenCalledWith('jane@example.com', 'Jane Doe');

    // addTagsToContact called with correct args
    expect(mockAddTagsToContact).toHaveBeenCalledWith('contact-123', ['tag-1', 'tag-2']);
  });

  it('creates contact without name when lead has no name', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: { id: 'fi-1', is_active: true, settings: { tag_ids: ['tag-1'] } },
      error: null,
    });

    await syncLeadToKajabi({
      userId: 'user-123',
      funnelPageId: 'funnel-page-456',
      lead: { email: 'noname@example.com' },
    });

    expect(mockCreateContact).toHaveBeenCalledWith('noname@example.com', undefined);
  });

  it('skips tags when settings has no tag_ids', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: { id: 'fi-1', is_active: true, settings: {} },
      error: null,
    });

    await syncLeadToKajabi(baseSyncParams);

    expect(mockCreateContact).toHaveBeenCalled();
    expect(mockAddTagsToContact).not.toHaveBeenCalled();
  });

  it('skips tags when tag_ids array is empty', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: { id: 'fi-1', is_active: true, settings: { tag_ids: [] } },
      error: null,
    });

    await syncLeadToKajabi(baseSyncParams);

    expect(mockCreateContact).toHaveBeenCalled();
    expect(mockAddTagsToContact).not.toHaveBeenCalled();
  });

  it('does not throw when createContact fails — fire-and-forget', async () => {
    mockGetUserIntegration.mockResolvedValue({
      id: 'int-1',
      user_id: 'user-123',
      service: 'kajabi',
      api_key: 'key-abc',
      webhook_secret: null,
      is_active: true,
      last_verified_at: null,
      metadata: { site_id: 'site-1' },
      created_at: '2026-01-01T00:00:00Z',
      updated_at: '2026-01-01T00:00:00Z',
    });

    createSupabaseMock({
      data: { id: 'fi-1', is_active: true, settings: { tag_ids: ['tag-1'] } },
      error: null,
    });

    mockCreateContact.mockRejectedValue(new Error('API error'));

    await expect(syncLeadToKajabi(baseSyncParams)).resolves.toBeUndefined();
  });

  it('does not throw when getUserIntegration throws', async () => {
    mockGetUserIntegration.mockRejectedValue(new Error('DB connection lost'));

    await expect(syncLeadToKajabi(baseSyncParams)).resolves.toBeUndefined();
  });
});
