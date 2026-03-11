/**
 * @jest-environment node
 */
import { HeyReachDmProvider } from '@/lib/providers/heyreach-dm';

jest.mock('@/lib/integrations/heyreach/client', () => ({
  HeyReachClient: jest.fn().mockImplementation(() => ({
    testConnection: jest.fn().mockResolvedValue(true),
    listCampaigns: jest.fn().mockResolvedValue({
      campaigns: [{ id: 123, name: 'Test Campaign', status: 'active', createdAt: '2026-01-01' }],
      total: 1,
    }),
    addContactsToCampaign: jest.fn().mockResolvedValue({ success: true, added: 2 }),
  })),
}));

describe('HeyReachDmProvider', () => {
  let provider: HeyReachDmProvider;

  beforeEach(() => {
    provider = new HeyReachDmProvider('test-api-key');
  });

  it('has correct provider metadata', () => {
    expect(provider.id).toBe('heyreach');
    expect(provider.name).toBe('HeyReach');
    expect(provider.integrationTier).toBe('provisionable');
  });

  it('tests connection via underlying client', async () => {
    const result = await provider.testConnection();
    expect(result).toBe(true);
  });

  it('lists campaigns', async () => {
    const campaigns = await provider.listCampaigns();
    expect(campaigns).toHaveLength(1);
    expect(campaigns[0].name).toBe('Test Campaign');
  });

  it('adds leads to campaign', async () => {
    const result = await provider.addLeadsToCampaign('123', [
      { linkedinUrl: 'https://linkedin.com/in/test/', firstName: 'John' },
    ]);
    expect(result.added).toBe(2);
  });

  it('returns empty stats', async () => {
    const stats = await provider.getCampaignStats('123');
    expect(stats.sent).toBe(0);
  });
});
