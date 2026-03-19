/**
 * @jest-environment node
 *
 * Tests for src/trigger/check-outreach-replies.ts
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@trigger.dev/sdk/v3', () => ({
  schedules: { task: (config: { run: (...args: unknown[]) => unknown }) => config },
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Outreach campaigns repo mocks
const mockListActiveCampaigns = jest.fn();
const mockGetMessagedLeadsPendingFollowUp = jest.fn();
const mockUpdateLead = jest.fn();

jest.mock('@/server/repositories/outreach-campaigns.repo', () => ({
  listActiveCampaigns: (...args: unknown[]) => mockListActiveCampaigns(...args),
  getMessagedLeadsPendingFollowUp: (...args: unknown[]) =>
    mockGetMessagedLeadsPendingFollowUp(...args),
  updateLead: (...args: unknown[]) => mockUpdateLead(...args),
}));

// LinkedIn action queue repo mocks
const mockEnqueueAction = jest.fn();
const mockHasPendingAction = jest.fn();

jest.mock('@/server/repositories/linkedin-action-queue.repo', () => ({
  enqueueAction: (...args: unknown[]) => mockEnqueueAction(...args),
  hasPendingAction: (...args: unknown[]) => mockHasPendingAction(...args),
}));

// Outreach campaigns service mocks
const mockRenderTemplate = jest.fn();

jest.mock('@/server/services/outreach-campaigns.service', () => ({
  renderTemplate: (...args: unknown[]) => mockRenderTemplate(...args),
}));

// Account safety service mocks
const mockShouldSkipRun = jest.fn();

jest.mock('@/server/services/account-safety.service', () => ({
  shouldSkipRun: (...args: unknown[]) => mockShouldSkipRun(...args),
}));

// Unipile client mock
const mockListChats = jest.fn();
const mockGetChatMessages = jest.fn();
const mockUnipileClient = {
  listChats: (...args: unknown[]) => mockListChats(...args),
  getChatMessages: (...args: unknown[]) => mockGetChatMessages(...args),
};

jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: () => mockUnipileClient,
}));

// Logger utility mock
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { checkOutreachReplies } from '@/trigger/check-outreach-replies';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger: mockLogger } = require('@trigger.dev/sdk/v3');

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TaskConfig = { run: () => Promise<unknown> };
const task = checkOutreachReplies as unknown as TaskConfig;

const _THREE_DAYS_MS = 3 * 86_400_000;
const SIX_DAYS_AGO = new Date(Date.now() - 6 * 86_400_000).toISOString();
const ONE_DAY_AGO = new Date(Date.now() - 1 * 86_400_000).toISOString();

function makeCampaign(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'campaign-1',
    user_id: 'user-1',
    team_id: null,
    name: 'Test Campaign',
    preset: 'warm_connect',
    unipile_account_id: 'account-1',
    connect_message: null,
    first_message_template: 'Hi {{name}}!',
    follow_up_template: 'Hey {{name}}, following up!',
    follow_up_delay_days: 3,
    withdraw_delay_days: 14,
    status: 'active',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeLead(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'lead-1',
    user_id: 'user-1',
    campaign_id: 'campaign-1',
    linkedin_url: 'https://linkedin.com/in/testuser',
    linkedin_username: 'testuser',
    unipile_provider_id: 'provider-abc',
    name: 'Test User',
    company: 'Acme Corp',
    current_step_order: 3,
    status: 'active',
    step_completed_at: null,
    viewed_at: null,
    connect_sent_at: null,
    connected_at: null,
    messaged_at: SIX_DAYS_AGO,
    follow_up_sent_at: null,
    withdrawn_at: null,
    error: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

function makeChat(attendeeProviderId: string = 'provider-abc') {
  return {
    id: 'chat-1',
    account_id: 'account-1',
    attendees: [{ id: 'att-1', provider_id: attendeeProviderId, name: 'Test User' }],
  };
}

function makeMessage(senderId: string, timestamp: string) {
  return {
    id: `msg-${senderId}-${timestamp}`,
    sender_id: senderId,
    text: 'Hello!',
    timestamp,
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('checkOutreachReplies', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Default safe setup
    mockShouldSkipRun.mockReturnValue(false);
    mockListActiveCampaigns.mockResolvedValue({ data: [], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [], error: null });
    mockUpdateLead.mockResolvedValue({ data: {}, error: null });
    mockHasPendingAction.mockResolvedValue(false);
    mockEnqueueAction.mockResolvedValue({ data: {}, error: null });
    mockRenderTemplate.mockReturnValue('Hey Test User, following up!');
    mockListChats.mockResolvedValue({ data: [], error: null });
    mockGetChatMessages.mockResolvedValue({ data: [], error: null });
  });

  // ── Jitter / skip ─────────────────────────────────────────────────────────

  it('skips ~10% of runs (shouldSkipRun returns true)', async () => {
    mockShouldSkipRun.mockReturnValue(true);

    const result = await task.run();

    expect(result).toEqual({ skipped: true });
    expect(mockListActiveCampaigns).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('check-outreach-replies: skipping run (jitter)');
  });

  // ── No campaigns ─────────────────────────────────────────────────────────

  it('returns early when no active campaigns exist', async () => {
    mockListActiveCampaigns.mockResolvedValue({ data: [], error: null });

    const result = await task.run();

    expect(result).toEqual({
      campaignsChecked: 0,
      repliesDetected: 0,
      followUpsEnqueued: 0,
      completions: 0,
    });
    expect(mockListChats).not.toHaveBeenCalled();
  });

  // ── Batch chat fetching ───────────────────────────────────────────────────

  it('fetches chats once per account even with multiple campaigns on same account', async () => {
    const campaign1 = makeCampaign({ id: 'campaign-1', unipile_account_id: 'account-1' });
    const campaign2 = makeCampaign({ id: 'campaign-2', unipile_account_id: 'account-1' });
    const campaign3 = makeCampaign({ id: 'campaign-3', unipile_account_id: 'account-2' });

    mockListActiveCampaigns.mockResolvedValue({
      data: [campaign1, campaign2, campaign3],
      error: null,
    });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [], error: null });
    mockListChats.mockResolvedValue({ data: [], error: null });

    await task.run();

    // account-1 and account-2: 2 calls total (not 3)
    expect(mockListChats).toHaveBeenCalledTimes(2);
    expect(mockListChats).toHaveBeenCalledWith('account-1');
    expect(mockListChats).toHaveBeenCalledWith('account-2');
  });

  // ── Reply detection ───────────────────────────────────────────────────────

  it('marks lead replied when chat has a reply from the target after messaged_at', async () => {
    const campaign = makeCampaign();
    const lead = makeLead();
    const chat = makeChat('provider-abc');
    const replyTimestamp = new Date(Date.now() - 1 * 86_400_000).toISOString(); // 1 day ago, after messaged 6 days ago
    const replyMsg = makeMessage('provider-abc', replyTimestamp); // sender is the lead, not us

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [chat], error: null });
    mockGetChatMessages.mockResolvedValue({ data: [replyMsg], error: null });

    const result = await task.run();

    expect(mockUpdateLead).toHaveBeenCalledWith('lead-1', {
      status: 'replied',
      updated_at: expect.any(String),
    });
    expect(result).toMatchObject({ repliesDetected: 1, followUpsEnqueued: 0 });
  });

  it('does NOT mark replied when message sender is our own account', async () => {
    const campaign = makeCampaign();
    const lead = makeLead({ messaged_at: SIX_DAYS_AGO });
    const chat = makeChat('provider-abc');
    // Message sent BY our account (sender_id === accountId)
    const ownMsg = makeMessage('account-1', new Date(Date.now() - 1 * 86_400_000).toISOString());

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [chat], error: null });
    mockGetChatMessages.mockResolvedValue({ data: [ownMsg], error: null });

    const result = await task.run();

    // Should NOT be marked replied — our own message doesn't count
    expect(mockUpdateLead).not.toHaveBeenCalledWith(
      'lead-1',
      expect.objectContaining({ status: 'replied' })
    );
    // Delay IS elapsed (6 days > 3 days), so follow-up is enqueued
    expect(result).toMatchObject({ repliesDetected: 0, followUpsEnqueued: 1 });
  });

  it('does NOT mark replied when reply is BEFORE messaged_at timestamp', async () => {
    const campaign = makeCampaign({ follow_up_delay_days: 3 });
    // messaged_at = 6 days ago; old reply = 8 days ago (before we sent the message)
    const lead = makeLead({ messaged_at: SIX_DAYS_AGO });
    const chat = makeChat('provider-abc');
    const oldReply = makeMessage(
      'provider-abc',
      new Date(Date.now() - 8 * 86_400_000).toISOString() // before messaged_at
    );

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [chat], error: null });
    mockGetChatMessages.mockResolvedValue({ data: [oldReply], error: null });

    const result = await task.run();

    // Old reply doesn't count — delay elapsed so follow-up is enqueued
    expect(result).toMatchObject({ repliesDetected: 0, followUpsEnqueued: 1 });
  });

  // ── Follow-up logic ───────────────────────────────────────────────────────

  it('enqueues follow_up_message when follow-up delay elapsed and template exists', async () => {
    const campaign = makeCampaign({
      follow_up_template: 'Hey {{name}}, following up!',
      follow_up_delay_days: 3,
    });
    const lead = makeLead({ messaged_at: SIX_DAYS_AGO }); // 6 days > 3 day delay

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [], error: null }); // no matching chat
    mockRenderTemplate.mockReturnValue('Hey Test User, following up!');

    const result = await task.run();

    expect(mockRenderTemplate).toHaveBeenCalledWith('Hey {{name}}, following up!', {
      name: 'Test User',
      company: 'Acme Corp',
    });
    expect(mockEnqueueAction).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        unipile_account_id: 'account-1',
        action_type: 'follow_up_message',
        payload: { text: 'Hey Test User, following up!' },
        source_campaign_id: 'campaign-1',
        source_lead_id: 'lead-1',
      })
    );
    expect(result).toMatchObject({ followUpsEnqueued: 1, completions: 0 });
  });

  it('marks lead completed when follow-up delay elapsed but no template configured', async () => {
    const campaign = makeCampaign({ follow_up_template: null, follow_up_delay_days: 3 });
    const lead = makeLead({ messaged_at: SIX_DAYS_AGO });

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [], error: null });

    const result = await task.run();

    expect(mockUpdateLead).toHaveBeenCalledWith('lead-1', {
      status: 'completed',
      updated_at: expect.any(String),
    });
    expect(mockEnqueueAction).not.toHaveBeenCalled();
    expect(result).toMatchObject({ completions: 1, followUpsEnqueued: 0 });
  });

  it('does NOT enqueue follow-up when delay has not elapsed', async () => {
    const campaign = makeCampaign({ follow_up_delay_days: 3 });
    const lead = makeLead({ messaged_at: ONE_DAY_AGO }); // only 1 day < 3 day delay

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [], error: null });

    const result = await task.run();

    expect(mockEnqueueAction).not.toHaveBeenCalled();
    expect(mockUpdateLead).not.toHaveBeenCalled();
    expect(result).toMatchObject({ followUpsEnqueued: 0, completions: 0 });
  });

  // ── Pending action guard ──────────────────────────────────────────────────

  it('skips leads that already have pending actions in the queue', async () => {
    const campaign = makeCampaign();
    const lead = makeLead({ messaged_at: SIX_DAYS_AGO });

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [], error: null });
    mockHasPendingAction.mockResolvedValue(true); // lead has pending action

    const result = await task.run();

    expect(mockEnqueueAction).not.toHaveBeenCalled();
    expect(mockUpdateLead).not.toHaveBeenCalled();
    expect(result).toMatchObject({ followUpsEnqueued: 0, repliesDetected: 0 });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('handles Unipile listChats error gracefully and continues to next account', async () => {
    const campaign1 = makeCampaign({ id: 'campaign-1', unipile_account_id: 'account-1' });
    const campaign2 = makeCampaign({ id: 'campaign-2', unipile_account_id: 'account-2' });

    mockListActiveCampaigns.mockResolvedValue({
      data: [campaign1, campaign2],
      error: null,
    });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [], error: null });

    // account-1 fails; account-2 succeeds
    mockListChats
      .mockResolvedValueOnce({ data: null, error: 'Rate limit' })
      .mockResolvedValueOnce({ data: [], error: null });

    const result = await task.run();

    // Should not throw — both accounts processed (second one succeeds)
    expect(mockListChats).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ campaignsChecked: 2 });
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'check-outreach-replies: failed to fetch chats for account',
      expect.objectContaining({ accountId: 'account-1' })
    );
  });

  it('handles getChatMessages error gracefully and skips that lead', async () => {
    const campaign = makeCampaign();
    const lead = makeLead({ messaged_at: SIX_DAYS_AGO });
    const chat = makeChat('provider-abc');

    mockListActiveCampaigns.mockResolvedValue({ data: [campaign], error: null });
    mockGetMessagedLeadsPendingFollowUp.mockResolvedValue({ data: [lead], error: null });
    mockListChats.mockResolvedValue({ data: [chat], error: null });
    mockGetChatMessages.mockResolvedValue({ data: null, error: 'Timeout' });

    const result = await task.run();

    // The lead was skipped — no update, no enqueue
    expect(mockUpdateLead).not.toHaveBeenCalled();
    expect(mockEnqueueAction).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      'check-outreach-replies: failed to fetch messages',
      expect.objectContaining({ leadId: 'lead-1' })
    );
    expect(result).toMatchObject({ repliesDetected: 0, followUpsEnqueued: 0 });
  });

  // ── Campaign error handling ───────────────────────────────────────────────

  it('returns error result when listActiveCampaigns fails', async () => {
    mockListActiveCampaigns.mockResolvedValue({ data: null, error: new Error('DB failure') });

    const result = await task.run();

    expect(result).toMatchObject({ error: 'Failed to load active campaigns' });
    expect(mockListChats).not.toHaveBeenCalled();
  });
});
