/**
 * @jest-environment node
 */
import {
  getAvailableProviders,
  resolveProvider,
  PROVIDER_REGISTRY,
} from '@/lib/providers/registry';

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  getSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function mockQuery(data: unknown = null) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue({ data, error: null });
  return chain;
}

describe('Provider Registry', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists available providers for dm_outreach', () => {
    const providers = getAvailableProviders('dm_outreach');
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].id).toBe('heyreach');
  });

  it('lists available providers for email_outreach', () => {
    const providers = getAvailableProviders('email_outreach');
    expect(providers.length).toBeGreaterThan(0);
    expect(providers[0].id).toBe('plusvibe');
  });

  it('returns guided fallback when no provider configured', async () => {
    mockFrom.mockReturnValue(mockQuery(null)); // no config found
    const provider = await resolveProvider('user-1', 'dm_outreach');
    expect(provider).toBeNull();
  });

  it('resolves configured provider for user', async () => {
    mockFrom.mockReturnValue(
      mockQuery({
        provider_id: 'heyreach',
        integration_tier: 'provisionable',
        config: { api_key: 'test-key' },
      })
    );
    const provider = await resolveProvider('user-1', 'dm_outreach');
    expect(provider).not.toBeNull();
    expect(provider!.id).toBe('heyreach');
  });

  it('has correct registry entries', () => {
    expect(PROVIDER_REGISTRY).toHaveLength(3);
    const heyreach = PROVIDER_REGISTRY.find((p) => p.id === 'heyreach');
    expect(heyreach?.capability).toBe('dm_outreach');
    expect(heyreach?.integrationTier).toBe('provisionable');
  });
});
