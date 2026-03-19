/**
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@trigger.dev/sdk/v3', () => ({
  schedules: { task: (config: { run: (...args: unknown[]) => unknown }) => config },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Outreach campaigns repo mocks
const mockListActiveCampaigns = jest.fn();
const mockGetSteps = jest.fn();
const mockGetLeadsByStatus = jest.fn();
const mockGetLeadsByStatuses = jest.fn();
const mockUpdateLead = jest.fn();
const mockUpdateCampaignStatusInternal = jest.fn();

jest.mock('@/server/repositories/outreach-campaigns.repo', () => ({
  listActiveCampaigns: (...args: unknown[]) => mockListActiveCampaigns(...args),
  getSteps: (...args: unknown[]) => mockGetSteps(...args),
  getLeadsByStatus: (...args: unknown[]) => mockGetLeadsByStatus(...args),
  getLeadsByStatuses: (...args: unknown[]) => mockGetLeadsByStatuses(...args),
  updateLead: (...args: unknown[]) => mockUpdateLead(...args),
  updateCampaignStatusInternal: (...args: unknown[]) => mockUpdateCampaignStatusInternal(...args),
}));

// Queue repo mocks
const mockGetUnprocessedResultsByCampaign = jest.fn();
const mockMarkProcessed = jest.fn();
const mockHasPendingAction = jest.fn();
const mockEnqueueAction = jest.fn();

jest.mock('@/server/repositories/linkedin-action-queue.repo', () => ({
  getUnprocessedResultsByCampaign: (...args: unknown[]) =>
    mockGetUnprocessedResultsByCampaign(...args),
  markProcessed: (...args: unknown[]) => mockMarkProcessed(...args),
  hasPendingAction: (...args: unknown[]) => mockHasPendingAction(...args),
  enqueueAction: (...args: unknown[]) => mockEnqueueAction(...args),
}));

// Service mocks
const mockRenderTemplate = jest.fn();

jest.mock('@/server/services/outreach-campaigns.service', () => ({
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
}));

// Utility mocks
const mockExtractLinkedInUsername = jest.fn();

jest.mock('@/lib/utils/linkedin-url', () => ({
  extractLinkedInUsername: (...args: unknown[]) => mockExtractLinkedInUsername(...args),
}));

// Logger utility mock
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Imports (after mocks) ──────────────────────────────────────────────────

import { advanceOutreachSequences } from '@/trigger/advance-outreach-sequences';

// ─── Helpers ────────────────────────────────────────────────────────────────

type TaskConfig = { run: () => Promise<unknown> };
const task = advanceOutreachSequences as unknown as TaskConfig;

/** A minimal active campaign for testing. */
function makeCampaign(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'campaign-1',
    user_id: 'user-1',
    team_id: null,
    name: 'Test Campaign',
    preset: 'warm_connect',
    unipile_account_id: 'account-1',
    connect_message: null,
    first_message_template: 'Hi {{name}}, great to connect!',
    follow_up_template: null,
    follow_up_delay_days: 3,
    withdraw_delay_days: 14,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** A minimal campaign lead for testing. */
function makeLead(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'lead-1',
    user_id: 'user-1',
    campaign_id: 'campaign-1',
    linkedin_url: 'https://linkedin.com/in/testuser',
    linkedin_username: 'testuser',
    unipile_provider_id: 'provider-1',
    name: 'Test User',
    company: 'Test Corp',
    current_step_order: 0,
    status: 'pending',
    step_completed_at: null,
    viewed_at: null,
    connect_sent_at: null,
    connected_at: null,
    messaged_at: null,
    follow_up_sent_at: null,
    withdrawn_at: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

/** A minimal completed queue action. */
function makeAction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'action-1',
    user_id: 'user-1',
    unipile_account_id: 'account-1',
    action_type: 'view_profile',
    target_provider_id: 'provider-1',
    target_linkedin_url: 'https://linkedin.com/in/testuser',
    payload: {},
    priority: 10,
    source_type: 'outreach_campaign',
    source_campaign_id: 'campaign-1',
    source_lead_id: 'lead-1',
    status: 'completed',
    processed: false,
    attempts: 1,
    error: null,
    result: { provider_id: 'provider-abc' },
    executed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Warm connect preset steps. */
const WARM_CONNECT_STEPS = [
  {
    id: 'step-1',
    campaign_id: 'campaign-1',
    step_order: 1,
    action_type: 'view_profile',
    delay_days: 0,
    delay_hours: 0,
    trigger: 'previous_completed',
    config: {},
  },
  {
    id: 'step-2',
    campaign_id: 'campaign-1',
    step_order: 2,
    action_type: 'connect',
    delay_days: 1,
    delay_hours: 0,
    trigger: 'previous_completed',
    config: {},
  },
  {
    id: 'step-3',
    campaign_id: 'campaign-1',
    step_order: 3,
    action_type: 'message',
    delay_days: 0,
    delay_hours: 0,
    trigger: 'connection_accepted',
    config: {},
  },
  {
    id: 'step-4',
    campaign_id: 'campaign-1',
    step_order: 4,
    action_type: 'follow_up_message',
    delay_days: 3,
    delay_hours: 0,
    trigger: 'no_reply',
    config: {},
  },
];

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('advanceOutreachSequences', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Defaults
    mockUpdateLead.mockResolvedValue({ data: {}, error: null });
    mockMarkProcessed.mockResolvedValue({ data: {}, error: null });
    mockEnqueueAction.mockResolvedValue({ data: {}, error: null });
    mockUpdateCampaignStatusInternal.mockResolvedValue({ data: {}, error: null });
    mockHasPendingAction.mockResolvedValue(false);
    mockExtractLinkedInUsername.mockReturnValue('testuser');
    mockRenderTemplate.mockImplementation((template: string) => template);
  });

  // ─── No campaigns ──────────────────────────────────────────────────────

  it('returns early when no active campaigns', async () => {
    mockListActiveCampaigns.mockResolvedValue({ data: [], error: null });

    const result = await task.run();

    expect(result).toEqual({ campaignsProcessed: 0 });
  });

  it('returns error when listActiveCampaigns fails', async () => {
    mockListActiveCampaigns.mockResolvedValue({ data: null, error: { message: 'DB error' } });

    const result = await task.run();

    expect(result).toEqual({ error: 'Failed to list active campaigns' });
  });

  // ─── Phase 1: Process Completed Actions ─────────────────────────────────

  describe('Phase 1: Process Completed Actions', () => {
    function setupPhase1(actions: ReturnType<typeof makeAction>[]) {
      mockListActiveCampaigns.mockResolvedValue({ data: [makeCampaign()], error: null });
      mockGetUnprocessedResultsByCampaign.mockResolvedValue({ data: actions, error: null });
      mockGetLeadsByStatus.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatuses.mockResolvedValue({ data: [], error: null });
      mockGetSteps.mockResolvedValue({ data: WARM_CONNECT_STEPS, error: null });
    }

    it('completed view_profile → sets viewed_at + caches provider_id', async () => {
      const action = makeAction({
        action_type: 'view_profile',
        status: 'completed',
        result: { provider_id: 'provider-abc' },
      });
      setupPhase1([action]);

      await task.run();

      expect(mockUpdateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          viewed_at: expect.any(String),
          current_step_order: 1,
          step_completed_at: expect.any(String),
          unipile_provider_id: 'provider-abc',
        })
      );
      expect(mockMarkProcessed).toHaveBeenCalledWith('action-1');
    });

    it('completed connect → sets connect_sent_at', async () => {
      const action = makeAction({
        action_type: 'connect',
        status: 'completed',
        result: {},
      });
      setupPhase1([action]);

      await task.run();

      expect(mockUpdateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          connect_sent_at: expect.any(String),
          current_step_order: 2,
          step_completed_at: expect.any(String),
        })
      );
      expect(mockMarkProcessed).toHaveBeenCalledWith('action-1');
    });

    it('completed message → sets messaged_at', async () => {
      const action = makeAction({
        action_type: 'message',
        status: 'completed',
        result: {},
      });
      setupPhase1([action]);

      await task.run();

      expect(mockUpdateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          messaged_at: expect.any(String),
          current_step_order: 3,
          step_completed_at: expect.any(String),
        })
      );
      expect(mockMarkProcessed).toHaveBeenCalledWith('action-1');
    });

    it('completed follow_up_message → sets follow_up_sent_at + marks completed', async () => {
      const action = makeAction({
        action_type: 'follow_up_message',
        status: 'completed',
        result: {},
      });
      setupPhase1([action]);

      await task.run();

      expect(mockUpdateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          follow_up_sent_at: expect.any(String),
          current_step_order: 4,
          status: 'completed',
          step_completed_at: expect.any(String),
        })
      );
      expect(mockMarkProcessed).toHaveBeenCalledWith('action-1');
    });

    it('completed withdraw → marks withdrawn', async () => {
      const action = makeAction({
        action_type: 'withdraw',
        status: 'completed',
        result: {},
      });
      setupPhase1([action]);

      await task.run();

      expect(mockUpdateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          withdrawn_at: expect.any(String),
          status: 'withdrawn',
          step_completed_at: expect.any(String),
        })
      );
      expect(mockMarkProcessed).toHaveBeenCalledWith('action-1');
    });

    it('failed action → marks lead failed', async () => {
      const action = makeAction({
        action_type: 'connect',
        status: 'failed',
        error: 'Connection request blocked',
        result: null,
      });
      setupPhase1([action]);

      await task.run();

      expect(mockUpdateLead).toHaveBeenCalledWith(
        'lead-1',
        expect.objectContaining({
          status: 'failed',
          error: 'Connection request blocked',
        })
      );
      expect(mockMarkProcessed).toHaveBeenCalledWith('action-1');
    });
  });

  // ─── Phase 2: Withdrawal Timeouts ──────────────────────────────────────

  describe('Phase 2: Withdrawal Timeouts', () => {
    function setupPhase2(leads: ReturnType<typeof makeLead>[]) {
      mockListActiveCampaigns.mockResolvedValue({ data: [makeCampaign()], error: null });
      mockGetUnprocessedResultsByCampaign.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatus.mockResolvedValue({ data: leads, error: null });
      mockGetLeadsByStatuses.mockResolvedValue({ data: [], error: null });
      mockGetSteps.mockResolvedValue({ data: WARM_CONNECT_STEPS, error: null });
    }

    it('connect_sent > withdraw_delay_days + no connected_at → enqueues withdraw', async () => {
      const lead = makeLead({
        status: 'active',
        connect_sent_at: new Date(Date.now() - 15 * 86_400_000).toISOString(), // 15 days ago
        connected_at: null,
      });
      setupPhase2([lead]);

      await task.run();

      expect(mockEnqueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'withdraw',
          source_lead_id: 'lead-1',
          source_campaign_id: 'campaign-1',
          target_provider_id: 'provider-1',
        })
      );
    });

    it('connect_sent < withdraw_delay_days → no withdraw', async () => {
      const lead = makeLead({
        status: 'active',
        connect_sent_at: new Date(Date.now() - 5 * 86_400_000).toISOString(), // 5 days ago (< 14)
        connected_at: null,
      });
      setupPhase2([lead]);

      await task.run();

      expect(mockEnqueueAction).not.toHaveBeenCalled();
    });

    it('does not withdraw if already connected', async () => {
      const lead = makeLead({
        status: 'active',
        connect_sent_at: new Date(Date.now() - 15 * 86_400_000).toISOString(),
        connected_at: new Date().toISOString(), // already connected
      });
      setupPhase2([lead]);

      await task.run();

      expect(mockEnqueueAction).not.toHaveBeenCalled();
    });

    it('does not withdraw if pending action exists', async () => {
      const lead = makeLead({
        status: 'active',
        connect_sent_at: new Date(Date.now() - 15 * 86_400_000).toISOString(),
        connected_at: null,
      });
      setupPhase2([lead]);
      mockHasPendingAction.mockResolvedValue(true);

      await task.run();

      expect(mockEnqueueAction).not.toHaveBeenCalled();
    });
  });

  // ─── Phase 3: Evaluate Next Steps ─────────────────────────────────────

  describe('Phase 3: Evaluate Next Steps', () => {
    function setupPhase3(leads: ReturnType<typeof makeLead>[]) {
      mockListActiveCampaigns.mockResolvedValue({ data: [makeCampaign()], error: null });
      mockGetUnprocessedResultsByCampaign.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatus.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatuses.mockResolvedValue({ data: leads, error: null });
      mockGetSteps.mockResolvedValue({ data: WARM_CONNECT_STEPS, error: null });
    }

    it('pending lead → enqueues view_profile, sets active', async () => {
      const lead = makeLead({ status: 'pending' });
      setupPhase3([lead]);

      await task.run();

      expect(mockEnqueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'view_profile',
          payload: { username: 'testuser' },
          source_lead_id: 'lead-1',
        })
      );
      expect(mockUpdateLead).toHaveBeenCalledWith('lead-1', { status: 'active' });
    });

    it('viewed + delay elapsed → enqueues connect', async () => {
      const lead = makeLead({
        status: 'active',
        viewed_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago
        step_completed_at: new Date(Date.now() - 2 * 86_400_000).toISOString(), // 2 days ago (> 1 day connect delay)
      });
      setupPhase3([lead]);

      await task.run();

      expect(mockEnqueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'connect',
          target_provider_id: 'provider-1',
          source_lead_id: 'lead-1',
        })
      );
    });

    it('viewed + delay NOT elapsed → skips', async () => {
      const lead = makeLead({
        status: 'active',
        viewed_at: new Date().toISOString(),
        step_completed_at: new Date().toISOString(), // just now (< 1 day connect delay)
      });
      setupPhase3([lead]);

      await task.run();

      expect(mockEnqueueAction).not.toHaveBeenCalled();
    });

    it('connected + no messaged → enqueues message with rendered template', async () => {
      const lead = makeLead({
        status: 'active',
        viewed_at: new Date().toISOString(),
        connect_sent_at: new Date().toISOString(),
        connected_at: new Date().toISOString(),
      });
      setupPhase3([lead]);
      mockRenderTemplate.mockReturnValue('Hi Test User, great to connect!');

      await task.run();

      expect(mockRenderTemplate).toHaveBeenCalledWith('Hi {{name}}, great to connect!', {
        name: 'Test User',
        company: 'Test Corp',
      });
      expect(mockEnqueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'message',
          target_provider_id: 'provider-1',
          payload: { text: 'Hi Test User, great to connect!' },
          source_lead_id: 'lead-1',
        })
      );
    });

    it('skip if hasPendingAction returns true', async () => {
      const lead = makeLead({ status: 'pending' });
      setupPhase3([lead]);
      mockHasPendingAction.mockResolvedValue(true);

      await task.run();

      expect(mockEnqueueAction).not.toHaveBeenCalled();
    });

    it('does not transition active lead to active again on view_profile', async () => {
      const lead = makeLead({ status: 'active' });
      setupPhase3([lead]);

      await task.run();

      expect(mockEnqueueAction).toHaveBeenCalledWith(
        expect.objectContaining({
          action_type: 'view_profile',
        })
      );
      // Should NOT call updateLead since lead is already active
      expect(mockUpdateLead).not.toHaveBeenCalled();
    });
  });

  // ─── Phase 4: Campaign Completion ──────────────────────────────────────

  describe('Phase 4: Campaign Completion', () => {
    it('all leads terminal → campaign completed', async () => {
      mockListActiveCampaigns.mockResolvedValue({ data: [makeCampaign()], error: null });
      mockGetUnprocessedResultsByCampaign.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatus.mockResolvedValue({ data: [], error: null });
      // Phase 3 getLeadsByStatuses for evaluate returns empty (no pending/active)
      // Phase 4 getLeadsByStatuses for completion check also returns empty
      mockGetLeadsByStatuses.mockResolvedValue({ data: [], error: null });
      mockGetSteps.mockResolvedValue({ data: WARM_CONNECT_STEPS, error: null });

      const result = await task.run();

      expect(mockUpdateCampaignStatusInternal).toHaveBeenCalledWith('campaign-1', 'completed');
      expect(result).toMatchObject({ totalCompleted: 1 });
    });

    it('active leads remain → campaign NOT completed', async () => {
      const lead = makeLead({ status: 'active' });
      mockListActiveCampaigns.mockResolvedValue({ data: [makeCampaign()], error: null });
      mockGetUnprocessedResultsByCampaign.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatus.mockResolvedValue({ data: [], error: null });
      mockGetLeadsByStatuses.mockResolvedValue({ data: [lead], error: null });
      mockGetSteps.mockResolvedValue({ data: WARM_CONNECT_STEPS, error: null });

      const result = await task.run();

      expect(mockUpdateCampaignStatusInternal).not.toHaveBeenCalled();
      expect(result).toMatchObject({ totalCompleted: 0 });
    });
  });

  // ─── Integration: Full run ─────────────────────────────────────────────

  it('processes multiple campaigns in sequence', async () => {
    const campaign1 = makeCampaign({ id: 'campaign-1' });
    const campaign2 = makeCampaign({ id: 'campaign-2' });

    mockListActiveCampaigns.mockResolvedValue({
      data: [campaign1, campaign2],
      error: null,
    });
    mockGetUnprocessedResultsByCampaign.mockResolvedValue({ data: [], error: null });
    mockGetLeadsByStatus.mockResolvedValue({ data: [], error: null });
    mockGetLeadsByStatuses.mockResolvedValue({ data: [], error: null });
    mockGetSteps.mockResolvedValue({ data: WARM_CONNECT_STEPS, error: null });

    const result = await task.run();

    expect(result).toMatchObject({ campaignsProcessed: 2 });
    // Both campaigns should be marked completed (no active/pending leads)
    expect(mockUpdateCampaignStatusInternal).toHaveBeenCalledTimes(2);
  });
});
