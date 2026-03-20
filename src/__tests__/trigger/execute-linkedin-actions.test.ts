/**
 * @jest-environment node
 */

// ─── Mocks ────────────────────────────────────────────────────────────────────

jest.mock('@trigger.dev/sdk/v3', () => ({
  schedules: { task: (config: { run: (...args: unknown[]) => unknown }) => config },
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

// Queue repo mocks
const mockDequeueNext = jest.fn();
const mockMarkExecuting = jest.fn();
const mockMarkCompleted = jest.fn();
const mockMarkFailed = jest.fn();
const mockInsertActivityLog = jest.fn();
const mockCleanupOldRows = jest.fn();
const mockGetDistinctQueuedAccounts = jest.fn();

jest.mock('@/server/repositories/linkedin-action-queue.repo', () => ({
  dequeueNext: (...args: unknown[]) => mockDequeueNext(...args),
  markExecuting: (...args: unknown[]) => mockMarkExecuting(...args),
  markCompleted: (...args: unknown[]) => mockMarkCompleted(...args),
  markFailed: (...args: unknown[]) => mockMarkFailed(...args),
  insertActivityLog: (...args: unknown[]) => mockInsertActivityLog(...args),
  cleanupOldRows: (...args: unknown[]) => mockCleanupOldRows(...args),
  getDistinctQueuedAccounts: (...args: unknown[]) => mockGetDistinctQueuedAccounts(...args),
}));

// Safety service mocks
const mockGetAccountSettings = jest.fn();
const mockIsWithinOperatingHours = jest.fn();
const mockIsCircuitBreakerActive = jest.fn();
const mockCheckDailyLimit = jest.fn();
const mockMapToLimitAction = jest.fn();
const mockRandomDelay = jest.fn();
const mockSleep = jest.fn();
const mockShouldSkipRun = jest.fn();
const mockActivateCircuitBreaker = jest.fn();

jest.mock('@/server/services/account-safety.service', () => ({
  getAccountSettings: (...args: unknown[]) => mockGetAccountSettings(...args),
  isWithinOperatingHours: (...args: unknown[]) => mockIsWithinOperatingHours(...args),
  isCircuitBreakerActive: (...args: unknown[]) => mockIsCircuitBreakerActive(...args),
  checkDailyLimit: (...args: unknown[]) => mockCheckDailyLimit(...args),
  mapToLimitAction: (...args: unknown[]) => mockMapToLimitAction(...args),
  randomDelay: (...args: unknown[]) => mockRandomDelay(...args),
  sleep: (...args: unknown[]) => mockSleep(...args),
  shouldSkipRun: (...args: unknown[]) => mockShouldSkipRun(...args),
  activateCircuitBreaker: (...args: unknown[]) => mockActivateCircuitBreaker(...args),
}));

// Account safety repo mock
const mockIncrementDailyLimit = jest.fn();

jest.mock('@/server/repositories/account-safety.repo', () => ({
  incrementDailyLimit: (...args: unknown[]) => mockIncrementDailyLimit(...args),
}));

// Executor mocks
const mockExecuteAction = jest.fn();
const mockIsRateLimitError = jest.fn();

jest.mock('@/server/services/linkedin-action-executor', () => ({
  executeAction: (...args: unknown[]) => mockExecuteAction(...args),
  isRateLimitError: (...args: unknown[]) => mockIsRateLimitError(...args),
}));

// Unipile client mock
const mockUnipileClient = { resolveLinkedInProfile: jest.fn() };
jest.mock('@/lib/integrations/unipile', () => ({
  getUnipileClient: () => mockUnipileClient,
}));

// Logger utility mock
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// ─── Imports (after mocks) ────────────────────────────────────────────────────

import { executeLinkedInActions } from '@/trigger/execute-linkedin-actions';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { logger: mockLogger } = require('@trigger.dev/sdk/v3');

// ─── Helpers ──────────────────────────────────────────────────────────────────

type TaskConfig = { run: () => Promise<unknown> };
const task = executeLinkedInActions as unknown as TaskConfig;

/** A minimal valid QueuedAction for testing. */
function makeAction(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'action-1',
    user_id: 'user-1',
    unipile_account_id: 'account-1',
    action_type: 'connect',
    target_provider_id: 'provider-1',
    target_linkedin_url: 'https://linkedin.com/in/testuser',
    payload: {},
    priority: 10,
    source_type: 'outreach_campaign',
    source_campaign_id: 'campaign-1',
    source_lead_id: 'lead-1',
    status: 'queued',
    processed: false,
    attempts: 0,
    error: null,
    result: null,
    executed_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

/** Default safe account settings. */
const safeSettings = {
  id: 'settings-1',
  user_id: 'user-1',
  unipile_account_id: 'account-1',
  operating_hours_start: '08:00',
  operating_hours_end: '19:00',
  timezone: 'America/New_York',
  max_dms_per_day: 20,
  max_connection_requests_per_day: 30,
  max_connection_accepts_per_day: 20,
  max_comments_per_day: 30,
  max_likes_per_day: 60,
  max_profile_views_per_day: 80,
  min_action_delay_ms: 100,
  max_action_delay_ms: 200,
  account_connected_at: null,
  circuit_breaker_until: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Set up mocks for a clean "one action succeeds" baseline.
 * beforeEach already resets all mocks; this only sets the action-specific values.
 */
function setupBaseline(action = makeAction()) {
  mockShouldSkipRun.mockReturnValue(false);
  mockGetDistinctQueuedAccounts.mockResolvedValue([
    { unipile_account_id: 'account-1', user_id: 'user-1' },
  ]);
  mockGetAccountSettings.mockResolvedValue(safeSettings);
  mockIsWithinOperatingHours.mockReturnValue(true);
  mockIsCircuitBreakerActive.mockReturnValue(false);
  // First call returns action, second returns empty (drain complete)
  mockDequeueNext
    .mockResolvedValueOnce({ data: action, error: null })
    .mockResolvedValueOnce({ data: null, error: null });
  mockMapToLimitAction.mockReturnValue('connection_request');
  mockCheckDailyLimit.mockResolvedValue({ allowed: true, current: 5, limit: 30 });
  mockExecuteAction.mockResolvedValue({ success: true });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('executeLinkedInActions', () => {
  beforeEach(() => {
    // resetAllMocks clears both call history AND mock implementations (including queued Once values)
    jest.resetAllMocks();
    // Default: time is mid-hour (minute 30), skip jitter cleanup
    jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(30);
    // Default: sleep resolves immediately
    mockSleep.mockResolvedValue(undefined);
    // Default: cleanup resolves without error
    mockCleanupOldRows.mockResolvedValue({ error: null });
    // Default: mark operations resolve without issue
    mockMarkExecuting.mockResolvedValue({ data: {}, error: null });
    mockMarkCompleted.mockResolvedValue({ data: {}, error: null });
    mockMarkFailed.mockResolvedValue({ data: {}, error: null });
    mockInsertActivityLog.mockResolvedValue({ data: {}, error: null });
    mockIncrementDailyLimit.mockResolvedValue(undefined);
    mockActivateCircuitBreaker.mockResolvedValue(undefined);
    mockRandomDelay.mockReturnValue(100);
    // Default: isRateLimitError returns false
    mockIsRateLimitError.mockReturnValue(false);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ── Jitter / skip ──────────────────────────────────────────────────────────

  it('skips run when shouldSkipRun returns true', async () => {
    mockShouldSkipRun.mockReturnValue(true);

    const result = await task.run();

    expect(result).toEqual({ skipped: true });
    expect(mockGetDistinctQueuedAccounts).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('execute-linkedin-actions: skipping run (jitter)');
  });

  // ── Cleanup ───────────────────────────────────────────────────────────────

  it('runs cleanup when minutes < 5', async () => {
    jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(2);
    mockShouldSkipRun.mockReturnValue(false);
    mockCleanupOldRows.mockResolvedValue({ error: null });
    mockGetDistinctQueuedAccounts.mockResolvedValue([]);

    await task.run();

    expect(mockCleanupOldRows).toHaveBeenCalledTimes(1);
  });

  it('does not run cleanup when minutes >= 5', async () => {
    jest.spyOn(Date.prototype, 'getMinutes').mockReturnValue(10);
    mockShouldSkipRun.mockReturnValue(false);
    mockGetDistinctQueuedAccounts.mockResolvedValue([]);

    await task.run();

    expect(mockCleanupOldRows).not.toHaveBeenCalled();
  });

  // ── Account gating ────────────────────────────────────────────────────────

  it('skips account outside operating hours', async () => {
    mockShouldSkipRun.mockReturnValue(false);
    mockGetDistinctQueuedAccounts.mockResolvedValue([
      { unipile_account_id: 'account-1', user_id: 'user-1' },
    ]);
    mockGetAccountSettings.mockResolvedValue(safeSettings);
    mockIsWithinOperatingHours.mockReturnValue(false);
    mockIsCircuitBreakerActive.mockReturnValue(false);

    const result = await task.run();

    expect(mockDequeueNext).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'execute-linkedin-actions: outside operating hours — skipping account',
      expect.objectContaining({ accountId: 'account-1' })
    );
    expect(result).toMatchObject({ totalActionsExecuted: 0 });
  });

  it('skips account with circuit breaker active', async () => {
    mockShouldSkipRun.mockReturnValue(false);
    mockGetDistinctQueuedAccounts.mockResolvedValue([
      { unipile_account_id: 'account-1', user_id: 'user-1' },
    ]);
    mockGetAccountSettings.mockResolvedValue(safeSettings);
    mockIsWithinOperatingHours.mockReturnValue(true);
    mockIsCircuitBreakerActive.mockReturnValue(true);

    const result = await task.run();

    expect(mockDequeueNext).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'execute-linkedin-actions: circuit breaker active — skipping account',
      expect.objectContaining({ accountId: 'account-1' })
    );
    expect(result).toMatchObject({ totalActionsExecuted: 0 });
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it('dequeues and executes actions in priority order', async () => {
    const action = makeAction({ action_type: 'connect' });
    setupBaseline(action);

    const result = await task.run();

    expect(mockDequeueNext).toHaveBeenCalledWith('account-1');
    // markExecuting no longer called — dequeue_and_claim RPC atomically sets status
    expect(mockExecuteAction).toHaveBeenCalledWith(mockUnipileClient, action);
    expect(mockMarkCompleted).toHaveBeenCalledWith('action-1', expect.any(Object));
    expect(mockInsertActivityLog).toHaveBeenCalledTimes(1);
    expect(mockIncrementDailyLimit).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ totalActionsExecuted: 1 });
  });

  it('skips action when daily limit reached', async () => {
    setupBaseline();
    mockCheckDailyLimit.mockResolvedValue({ allowed: false, current: 30, limit: 30 });

    const result = await task.run();

    expect(mockMarkExecuting).not.toHaveBeenCalled();
    expect(mockExecuteAction).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'execute-linkedin-actions: daily limit reached — stopping account',
      expect.objectContaining({ accountId: 'account-1' })
    );
    expect(result).toMatchObject({ totalActionsExecuted: 0 });
  });

  it('checks daily limit for view_profile (profile_view action type)', async () => {
    const action = makeAction({ action_type: 'view_profile' });
    setupBaseline(action);
    mockMapToLimitAction.mockReturnValue('profile_view');
    mockCheckDailyLimit.mockResolvedValue({ allowed: true, current: 10, limit: 80 });

    await task.run();

    expect(mockMapToLimitAction).toHaveBeenCalledWith('view_profile');
    expect(mockCheckDailyLimit).toHaveBeenCalledWith('account-1', 'profile_view', safeSettings);
    expect(mockExecuteAction).toHaveBeenCalled();
  });

  it('does not check daily limit for withdraw (null limit action)', async () => {
    const action = makeAction({ action_type: 'withdraw' });
    setupBaseline(action);
    mockMapToLimitAction.mockReturnValue(null);

    await task.run();

    expect(mockCheckDailyLimit).not.toHaveBeenCalled();
    expect(mockExecuteAction).toHaveBeenCalled();
    expect(mockIncrementDailyLimit).not.toHaveBeenCalled();
  });

  it('marks completed, logs activity, and increments limit on success', async () => {
    const action = makeAction({ action_type: 'message' });
    setupBaseline(action);
    mockMapToLimitAction.mockReturnValue('dm');
    const executionResult = { chat_id: 'chat-123' };
    mockExecuteAction.mockResolvedValue(executionResult);

    await task.run();

    expect(mockMarkCompleted).toHaveBeenCalledWith('action-1', executionResult);
    expect(mockInsertActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        unipile_account_id: 'account-1',
        action_type: 'message',
        source_campaign_id: 'campaign-1',
        source_lead_id: 'lead-1',
        result: executionResult,
      })
    );
    expect(mockIncrementDailyLimit).toHaveBeenCalledWith('account-1', expect.any(String), 'dm');
  });

  // ── Rate limit / error handling ───────────────────────────────────────────

  it('activates circuit breaker, marks failed, and breaks on rate limit error', async () => {
    const action = makeAction();
    setupBaseline(action);
    const rateLimitError = new Error('429 rate limit exceeded');
    mockExecuteAction.mockRejectedValue(rateLimitError);
    mockIsRateLimitError.mockReturnValue(true);

    const result = await task.run();

    expect(mockActivateCircuitBreaker).toHaveBeenCalledWith(
      'user-1',
      'account-1',
      expect.any(String)
    );
    expect(mockMarkFailed).toHaveBeenCalledWith('action-1', expect.any(String));
    // Should have broken — no second action attempted
    expect(mockMarkCompleted).not.toHaveBeenCalled();
    expect(result).toMatchObject({ totalActionsExecuted: 0 });
  });

  it('marks failed and continues on normal error', async () => {
    const action1 = makeAction({ id: 'action-1' });
    const action2 = makeAction({ id: 'action-2' });
    const normalError = new Error('Temporary API error');

    mockShouldSkipRun.mockReturnValue(false);
    mockGetDistinctQueuedAccounts.mockResolvedValue([
      { unipile_account_id: 'account-1', user_id: 'user-1' },
    ]);
    mockGetAccountSettings.mockResolvedValue(safeSettings);
    mockIsWithinOperatingHours.mockReturnValue(true);
    mockIsCircuitBreakerActive.mockReturnValue(false);
    mockDequeueNext
      .mockResolvedValueOnce({ data: action1, error: null })
      .mockResolvedValueOnce({ data: action2, error: null })
      .mockResolvedValueOnce({ data: null, error: null });
    mockMapToLimitAction.mockReturnValue('connection_request');
    mockCheckDailyLimit.mockResolvedValue({ allowed: true, current: 0, limit: 30 });
    mockMarkExecuting.mockResolvedValue({ data: {}, error: null });
    mockExecuteAction.mockRejectedValueOnce(normalError).mockResolvedValueOnce({ success: true });
    mockIsRateLimitError.mockReturnValue(false);
    mockMarkCompleted.mockResolvedValue({ data: {}, error: null });
    mockMarkFailed.mockResolvedValue({ data: {}, error: null });
    mockInsertActivityLog.mockResolvedValue({ data: {}, error: null });
    mockIncrementDailyLimit.mockResolvedValue(undefined);
    mockRandomDelay.mockReturnValue(100);
    mockSleep.mockResolvedValue(undefined);
    mockCleanupOldRows.mockResolvedValue({ error: null });
    mockActivateCircuitBreaker.mockResolvedValue(undefined);

    const result = await task.run();

    expect(mockMarkFailed).toHaveBeenCalledWith('action-1', normalError.message);
    expect(mockMarkCompleted).toHaveBeenCalledWith('action-2', expect.any(Object));
    // Both actions count: failed action still increments actionsThisRun
    expect(result).toMatchObject({ totalActionsExecuted: 1 }); // only success counts total
  });

  // ── MAX_ACTIONS_PER_RUN cap ──────────────────────────────────────────────

  it('stops at MAX_ACTIONS_PER_RUN (3) per account', async () => {
    mockShouldSkipRun.mockReturnValue(false);
    mockGetDistinctQueuedAccounts.mockResolvedValue([
      { unipile_account_id: 'account-1', user_id: 'user-1' },
    ]);
    mockGetAccountSettings.mockResolvedValue(safeSettings);
    mockIsWithinOperatingHours.mockReturnValue(true);
    mockIsCircuitBreakerActive.mockReturnValue(false);
    // Return 4 actions, but only 3 should execute (MAX_ACTIONS_PER_RUN = 3)
    mockDequeueNext
      .mockResolvedValueOnce({ data: makeAction({ id: 'a1' }), error: null })
      .mockResolvedValueOnce({ data: makeAction({ id: 'a2' }), error: null })
      .mockResolvedValueOnce({ data: makeAction({ id: 'a3' }), error: null })
      .mockResolvedValueOnce({ data: makeAction({ id: 'a4' }), error: null });
    mockMapToLimitAction.mockReturnValue(null);
    mockMarkExecuting.mockResolvedValue({ data: {}, error: null });
    mockExecuteAction.mockResolvedValue({ success: true });
    mockMarkCompleted.mockResolvedValue({ data: {}, error: null });
    mockInsertActivityLog.mockResolvedValue({ data: {}, error: null });
    mockIncrementDailyLimit.mockResolvedValue(undefined);
    mockIsRateLimitError.mockReturnValue(false);
    mockRandomDelay.mockReturnValue(50);
    mockSleep.mockResolvedValue(undefined);
    mockCleanupOldRows.mockResolvedValue({ error: null });
    mockMarkFailed.mockResolvedValue({ data: {}, error: null });
    mockActivateCircuitBreaker.mockResolvedValue(undefined);

    const result = await task.run();

    // Only 3 actions should have been executed (MAX_ACTIONS_PER_RUN constant = 3)
    expect(mockExecuteAction).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ totalActionsExecuted: 3 });
  });

  // ── Delay ────────────────────────────────────────────────────────────────

  it('sleeps between actions using randomDelay(settings)', async () => {
    const action = makeAction();
    setupBaseline(action);
    mockRandomDelay.mockReturnValue(1500);

    await task.run();

    expect(mockRandomDelay).toHaveBeenCalledWith(safeSettings);
    expect(mockSleep).toHaveBeenCalledWith(1500);
  });

  // ── No queued accounts ───────────────────────────────────────────────────

  it('returns early with zero counts when no accounts are queued', async () => {
    mockShouldSkipRun.mockReturnValue(false);
    mockGetDistinctQueuedAccounts.mockResolvedValue([]);

    const result = await task.run();

    expect(result).toEqual({ accountsProcessed: 0, totalActionsExecuted: 0 });
    expect(mockDequeueNext).not.toHaveBeenCalled();
  });
});
