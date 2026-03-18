/**
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockFrom = jest.fn();

const mockSupabase = { from: mockFrom };

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: () => mockSupabase,
}));

jest.mock('@trigger.dev/sdk/v3', () => ({
  schedules: {
    task: (config: { run: (...args: unknown[]) => unknown }) => config,
  },
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Import AFTER mocks — must use require for the mocked logger reference
import { expireCampaignLeads } from '@/trigger/expire-campaign-leads';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger: mockLogger } = require('@trigger.dev/sdk/v3');

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TaskConfig = { run: () => Promise<{ expired: number; error?: string }> };
const task = expireCampaignLeads as unknown as TaskConfig;

/** Set up the campaign query chain: from('post_campaigns').select().eq() */
function setupCampaignQuery(
  campaigns: Array<{ id: string; lead_expiry_days: number }> | null,
  error: { message: string } | null = null
) {
  const campaignEq = jest.fn().mockReturnValue({ data: campaigns, error });
  const campaignSelect = jest.fn().mockReturnValue({ eq: campaignEq });
  return { select: campaignSelect };
}

/** Set up the lead update chain: from('post_campaign_leads').update().eq().in().lt() */
function setupLeadUpdate(count: number | null, error: { message: string } | null = null) {
  const ltMock = jest.fn().mockReturnValue({ count, error });
  const inMock = jest.fn().mockReturnValue({ lt: ltMock });
  const eqMock = jest.fn().mockReturnValue({ in: inMock });
  const updateMock = jest.fn().mockReturnValue({ eq: eqMock });
  return { update: updateMock, eq: eqMock, in: inMock, lt: ltMock };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('expireCampaignLeads', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 0 expired when no active campaigns exist', async () => {
    const campaignChain = setupCampaignQuery([]);
    mockFrom.mockReturnValue(campaignChain);

    const result = await task.run();

    expect(result).toEqual({ expired: 0 });
    expect(mockLogger.info).toHaveBeenCalledWith('No active campaigns — nothing to expire');
  });

  it('expires leads detected beyond lead_expiry_days', async () => {
    const campaignChain = setupCampaignQuery([{ id: 'camp-1', lead_expiry_days: 7 }]);

    const leadChain = setupLeadUpdate(3);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'post_campaigns') return campaignChain;
      if (table === 'post_campaign_leads') return leadChain;
      return {};
    });

    const result = await task.run();

    expect(result).toEqual({ expired: 3 });
    // Verify update was called with expired status
    expect(leadChain.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'expired' }), {
      count: 'exact',
    });
    // Verify campaign_id filter
    expect(leadChain.eq).toHaveBeenCalledWith('campaign_id', 'camp-1');
    // Verify only expirable statuses
    expect(leadChain.in).toHaveBeenCalledWith('status', ['detected', 'connection_pending']);
    // Verify detected_at cutoff is applied
    expect(leadChain.lt).toHaveBeenCalledWith('detected_at', expect.any(String));
  });

  it('does not expire leads detected within lead_expiry_days (count=0)', async () => {
    const campaignChain = setupCampaignQuery([{ id: 'camp-1', lead_expiry_days: 7 }]);

    const leadChain = setupLeadUpdate(0);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'post_campaigns') return campaignChain;
      if (table === 'post_campaign_leads') return leadChain;
      return {};
    });

    const result = await task.run();

    expect(result).toEqual({ expired: 0 });
  });

  it('processes multiple campaigns with different expiry days', async () => {
    const campaignChain = setupCampaignQuery([
      { id: 'camp-1', lead_expiry_days: 7 },
      { id: 'camp-2', lead_expiry_days: 14 },
    ]);

    let callCount = 0;
    const leadChains = [setupLeadUpdate(2), setupLeadUpdate(5)];

    mockFrom.mockImplementation((table: string) => {
      if (table === 'post_campaigns') return campaignChain;
      if (table === 'post_campaign_leads') {
        const chain = leadChains[callCount];
        callCount++;
        return chain;
      }
      return {};
    });

    const result = await task.run();

    expect(result).toEqual({ expired: 7 }); // 2 + 5
  });

  it('handles campaign query error gracefully', async () => {
    const campaignChain = setupCampaignQuery(null, { message: 'DB connection error' });
    mockFrom.mockReturnValue(campaignChain);

    const result = await task.run();

    expect(result).toEqual({ expired: 0, error: 'DB connection error' });
    expect(mockLogger.error).toHaveBeenCalledWith('Failed to fetch active campaigns', {
      error: 'DB connection error',
    });
  });

  it('continues processing other campaigns when one fails', async () => {
    const campaignChain = setupCampaignQuery([
      { id: 'camp-1', lead_expiry_days: 7 },
      { id: 'camp-2', lead_expiry_days: 14 },
    ]);

    let callCount = 0;
    const failChain = setupLeadUpdate(null, { message: 'Update failed' });
    const successChain = setupLeadUpdate(3);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'post_campaigns') return campaignChain;
      if (table === 'post_campaign_leads') {
        const chain = callCount === 0 ? failChain : successChain;
        callCount++;
        return chain;
      }
      return {};
    });

    const result = await task.run();

    // First campaign failed, second succeeded with 3
    expect(result).toEqual({ expired: 3 });
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to expire leads for campaign',
      expect.objectContaining({ campaignId: 'camp-1' })
    );
  });

  it('uses correct cutoff date based on lead_expiry_days', async () => {
    const campaignChain = setupCampaignQuery([{ id: 'camp-1', lead_expiry_days: 10 }]);

    const leadChain = setupLeadUpdate(1);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'post_campaigns') return campaignChain;
      if (table === 'post_campaign_leads') return leadChain;
      return {};
    });

    const beforeRun = new Date();
    await task.run();

    // Verify the cutoff date passed to lt() is approximately 10 days ago
    const ltCallArg = leadChain.lt.mock.calls[0][1] as string;
    const cutoffDate = new Date(ltCallArg);
    const expectedCutoff = new Date(beforeRun);
    expectedCutoff.setDate(expectedCutoff.getDate() - 10);

    // Allow 5 seconds of tolerance for test execution time
    const diffMs = Math.abs(cutoffDate.getTime() - expectedCutoff.getTime());
    expect(diffMs).toBeLessThan(5000);
  });

  it('sets expired_at to current timestamp on expired leads', async () => {
    const campaignChain = setupCampaignQuery([{ id: 'camp-1', lead_expiry_days: 7 }]);

    const leadChain = setupLeadUpdate(1);

    mockFrom.mockImplementation((table: string) => {
      if (table === 'post_campaigns') return campaignChain;
      if (table === 'post_campaign_leads') return leadChain;
      return {};
    });

    const beforeRun = new Date();
    await task.run();

    const updateArg = leadChain.update.mock.calls[0][0] as {
      status: string;
      expired_at: string;
    };
    expect(updateArg.status).toBe('expired');
    expect(updateArg.expired_at).toBeDefined();

    // expired_at should be close to now
    const expiredAt = new Date(updateArg.expired_at);
    const diffMs = Math.abs(expiredAt.getTime() - beforeRun.getTime());
    expect(diffMs).toBeLessThan(5000);
  });
});
