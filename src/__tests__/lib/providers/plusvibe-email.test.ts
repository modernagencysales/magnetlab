/**
 * @jest-environment node
 */
import { PlusVibeEmailProvider } from '@/lib/providers/plusvibe-email';

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('PlusVibeEmailProvider', () => {
  let provider: PlusVibeEmailProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new PlusVibeEmailProvider('test-api-key');
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('plusvibe');
    expect(provider.name).toBe('PlusVibe');
    expect(provider.integrationTier).toBe('provisionable');
  });

  it('tests connection by listing campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [{ _id: '1', camp_name: 'Test' }] }),
    });
    const result = await provider.testConnection();
    expect(result).toBe(true);
  });

  it('returns false on connection failure', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 401 });
    const result = await provider.testConnection();
    expect(result).toBe(false);
  });

  it('returns false when fetch throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const result = await provider.testConnection();
    expect(result).toBe(false);
  });

  it('lists campaigns', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'camp-1', camp_name: 'Cold Outreach', status: 'active' },
          { _id: 'camp-2', camp_name: 'Follow Up', status: 'paused' },
        ],
      }),
    });
    const campaigns = await provider.listCampaigns();
    expect(campaigns).toHaveLength(2);
    expect(campaigns[0].id).toBe('camp-1');
    expect(campaigns[0].name).toBe('Cold Outreach');
    expect(campaigns[0].status).toBe('active');
    expect(campaigns[1].id).toBe('camp-2');
  });

  it('returns empty array when listing campaigns fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const campaigns = await provider.listCampaigns();
    expect(campaigns).toEqual([]);
  });

  it('returns empty array when listing campaigns throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const campaigns = await provider.listCampaigns();
    expect(campaigns).toEqual([]);
  });

  it('gets campaign stats', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: {
          total_sent: 100,
          total_opened: 40,
          total_replied: 10,
          total_bounced: 2,
        },
      }),
    });
    const stats = await provider.getCampaignStats('camp-1');
    expect(stats.sent).toBe(100);
    expect(stats.opened).toBe(40);
    expect(stats.replied).toBe(10);
    expect(stats.bounced).toBe(2);
  });

  it('returns zero stats when getCampaignStats fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
    const stats = await provider.getCampaignStats('camp-1');
    expect(stats).toEqual({ sent: 0, opened: 0, replied: 0, bounced: 0 });
  });

  it('returns zero stats when getCampaignStats throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const stats = await provider.getCampaignStats('camp-1');
    expect(stats).toEqual({ sent: 0, opened: 0, replied: 0, bounced: 0 });
  });

  it('adds leads to campaign', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ added_count: 3 }),
    });
    const result = await provider.addLeadsToCampaign('camp-1', [
      { linkedinUrl: '', firstName: 'John', email: 'john@test.com' },
    ]);
    expect(result.added).toBe(3);
  });

  it('uses lead count as fallback when added_count missing', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });
    const leads = [
      { linkedinUrl: '', firstName: 'Alice', email: 'alice@test.com' },
      { linkedinUrl: '', firstName: 'Bob', email: 'bob@test.com' },
    ];
    const result = await provider.addLeadsToCampaign('camp-1', leads);
    expect(result.added).toBe(2);
  });

  it('returns zero added when addLeadsToCampaign fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 400 });
    const result = await provider.addLeadsToCampaign('camp-1', [
      { linkedinUrl: '', email: 'test@test.com' },
    ]);
    expect(result.added).toBe(0);
  });

  it('returns zero added when addLeadsToCampaign throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Timeout'));
    const result = await provider.addLeadsToCampaign('camp-1', [
      { linkedinUrl: '', email: 'test@test.com' },
    ]);
    expect(result.added).toBe(0);
  });

  it('gets warmup status', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          {
            _id: 'acc-1',
            email: 'warm@test.com',
            warmup_enabled: true,
            warmup_started_at: '2026-02-01',
          },
        ],
      }),
    });
    const statuses = await provider.getWarmupStatus();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].accountId).toBe('acc-1');
    expect(statuses[0].email).toBe('warm@test.com');
    expect(statuses[0].isWarming).toBe(true);
    expect(statuses[0].daysSinceStart).toBeGreaterThan(0);
  });

  it('handles account with no warmup start date', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [
          { _id: 'acc-2', email: 'cold@test.com', warmup_enabled: false },
        ],
      }),
    });
    const statuses = await provider.getWarmupStatus();
    expect(statuses[0].isWarming).toBe(false);
    expect(statuses[0].daysSinceStart).toBe(0);
  });

  it('returns empty array when getWarmupStatus fails', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    const statuses = await provider.getWarmupStatus();
    expect(statuses).toEqual([]);
  });

  it('returns empty array when getWarmupStatus throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const statuses = await provider.getWarmupStatus();
    expect(statuses).toEqual([]);
  });

  it('sends x-api-key header in requests', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    });
    await provider.listCampaigns();
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toContain('https://api.plusvibe.ai/api/v1');
    expect(callArgs[1].headers['x-api-key']).toBe('test-api-key');
  });
});
