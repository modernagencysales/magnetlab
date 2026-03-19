/**
 * @jest-environment node
 *
 * Tests for src/server/repositories/linkedin-action-queue.repo.ts
 * All Supabase calls are mocked via createSupabaseAdminClient.
 */

import {
  enqueueAction,
  dequeueNext,
  markExecuting,
  markCompleted,
  markFailed,
  markProcessed,
  cancelByCampaign,
  cancelByLead,
  getUnprocessedResults,
  getUnprocessedResultsByCampaign,
  hasPendingAction,
  getDistinctQueuedAccounts,
  cleanupOldRows,
  insertActivityLog,
  listActivityLog,
} from '@/server/repositories/linkedin-action-queue.repo';

// ─── Mocks ──────────────────────────────────────────────────────────────────

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock chain builder ──────────────────────────────────────────────────────

/**
 * Creates a chainable mock Supabase client.
 * All query builder methods return the chain itself.
 * Terminal calls (single, maybeSingle) resolve to result.
 * Awaiting the chain directly resolves via .then (for list queries).
 */
function createMockChain(
  result: { data: unknown; error: unknown; count?: number | null } = { data: null, error: null }
) {
  const chain: Record<string, jest.Mock> = {};

  const methods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'neq',
    'in',
    'or',
    'lt',
    'lte',
    'gte',
    'gt',
    'order',
    'limit',
    'range',
  ];

  for (const m of methods) {
    chain[m] = jest.fn(() => chain);
  }

  // Terminal: resolves with result
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));

  // For list queries (no terminal call) — resolved by awaiting
  chain.then = jest.fn((resolve: (val: unknown) => void) => resolve(result));

  return chain;
}

function setupMockClient(
  results: Array<{ data: unknown; error: unknown; count?: number | null }> = []
) {
  let callIndex = 0;
  const defaultResult = { data: null, error: null };

  const client = {
    from: jest.fn(() => {
      const result = results[callIndex] ?? defaultResult;
      callIndex++;
      return createMockChain(result);
    }),
  };

  (createSupabaseAdminClient as jest.Mock).mockReturnValue(client);
  return client;
}

// ─── Test data ──────────────────────────────────────────────────────────────

const QUEUED_ACTION = {
  id: 'action-1',
  user_id: 'user-1',
  unipile_account_id: 'acc-1',
  action_type: 'connect',
  target_provider_id: 'prov-123',
  target_linkedin_url: 'https://linkedin.com/in/johndoe',
  payload: { message: 'Hello!' },
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
  created_at: '2026-03-19T10:00:00Z',
};

const ENQUEUE_INPUT = {
  user_id: 'user-1',
  unipile_account_id: 'acc-1',
  action_type: 'connect' as const,
  target_provider_id: 'prov-123',
  target_linkedin_url: 'https://linkedin.com/in/johndoe',
  payload: { message: 'Hello!' },
  priority: 10,
  source_type: 'outreach_campaign' as const,
  source_campaign_id: 'campaign-1',
  source_lead_id: 'lead-1',
};

const ACTIVITY_LOG_ROW = {
  id: 'log-1',
  user_id: 'user-1',
  unipile_account_id: 'acc-1',
  action_type: 'connect',
  target_provider_id: 'prov-123',
  target_linkedin_url: 'https://linkedin.com/in/johndoe',
  source_type: 'outreach_campaign',
  source_campaign_id: 'campaign-1',
  source_lead_id: 'lead-1',
  payload: { message: 'Hello!' },
  result: { success: true },
  created_at: '2026-03-19T10:00:00Z',
};

// ─── enqueueAction ──────────────────────────────────────────────────────────

describe('enqueueAction', () => {
  it('inserts with correct payload and returns the created row', async () => {
    setupMockClient([{ data: QUEUED_ACTION, error: null }]);

    const result = await enqueueAction(ENQUEUE_INPUT);

    expect(result.data).toEqual(QUEUED_ACTION);
    expect(result.error).toBeNull();

    const client = (createSupabaseAdminClient as jest.Mock).mock.results[0].value;
    expect(client.from).toHaveBeenCalledWith('linkedin_action_queue');
  });

  it('sets default fields: status=queued, processed=false, attempts=0', async () => {
    const client = setupMockClient([{ data: QUEUED_ACTION, error: null }]);
    const chain = createMockChain({ data: QUEUED_ACTION, error: null });
    client.from.mockReturnValue(chain);

    await enqueueAction(ENQUEUE_INPUT);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'queued',
        processed: false,
        attempts: 0,
      })
    );
  });

  it('coerces undefined optional fields to null', async () => {
    const client = setupMockClient([{ data: QUEUED_ACTION, error: null }]);
    const chain = createMockChain({ data: QUEUED_ACTION, error: null });
    client.from.mockReturnValue(chain);

    const inputWithoutOptionals = { ...ENQUEUE_INPUT };
    delete (inputWithoutOptionals as Partial<typeof ENQUEUE_INPUT>).target_provider_id;
    delete (inputWithoutOptionals as Partial<typeof ENQUEUE_INPUT>).target_linkedin_url;

    await enqueueAction(inputWithoutOptionals as typeof ENQUEUE_INPUT);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        target_provider_id: null,
        target_linkedin_url: null,
      })
    );
  });

  it('returns error on DB failure', async () => {
    setupMockClient([{ data: null, error: { message: 'insert failed' } }]);

    const result = await enqueueAction(ENQUEUE_INPUT);

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: 'insert failed' });
  });
});

// ─── dequeueNext ────────────────────────────────────────────────────────────

describe('dequeueNext', () => {
  it('queries with correct filters and ordering', async () => {
    const client = setupMockClient([{ data: QUEUED_ACTION, error: null }]);
    const chain = createMockChain({ data: QUEUED_ACTION, error: null });
    client.from.mockReturnValue(chain);

    const result = await dequeueNext('acc-1');

    expect(result.data).toEqual(QUEUED_ACTION);
    expect(chain.eq).toHaveBeenCalledWith('unipile_account_id', 'acc-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'queued');
    expect(chain.order).toHaveBeenCalledWith('priority', { ascending: true });
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(chain.limit).toHaveBeenCalledWith(1);
    expect(chain.maybeSingle).toHaveBeenCalled();
  });

  it('returns null data when no queued actions exist', async () => {
    setupMockClient([{ data: null, error: null }]);

    const result = await dequeueNext('acc-empty');

    expect(result.data).toBeNull();
    expect(result.error).toBeNull();
  });
});

// ─── markExecuting ──────────────────────────────────────────────────────────

describe('markExecuting', () => {
  it('updates status to executing', async () => {
    const client = setupMockClient([
      { data: { ...QUEUED_ACTION, status: 'executing' }, error: null },
    ]);
    const chain = createMockChain({ data: { ...QUEUED_ACTION, status: 'executing' }, error: null });
    client.from.mockReturnValue(chain);

    const result = await markExecuting('action-1');

    expect(result.data?.status).toBe('executing');
    expect(chain.update).toHaveBeenCalledWith({ status: 'executing' });
    expect(chain.eq).toHaveBeenCalledWith('id', 'action-1');
  });
});

// ─── markCompleted ──────────────────────────────────────────────────────────

describe('markCompleted', () => {
  it('updates status, executed_at, and result', async () => {
    const resultPayload = { connection_id: 'conn-abc' };
    const completedRow = {
      ...QUEUED_ACTION,
      status: 'completed',
      executed_at: '2026-03-19T10:05:00Z',
      result: resultPayload,
    };
    const client = setupMockClient([{ data: completedRow, error: null }]);
    const chain = createMockChain({ data: completedRow, error: null });
    client.from.mockReturnValue(chain);

    const result = await markCompleted('action-1', resultPayload);

    expect(result.data?.status).toBe('completed');
    expect(result.data?.result).toEqual(resultPayload);

    const updateCall = chain.update.mock.calls[0][0];
    expect(updateCall.status).toBe('completed');
    expect(updateCall.result).toEqual(resultPayload);
    expect(typeof updateCall.executed_at).toBe('string');
  });
});

// ─── markFailed ─────────────────────────────────────────────────────────────

describe('markFailed', () => {
  it('updates status to failed with error message', async () => {
    const failedRow = { ...QUEUED_ACTION, status: 'failed', error: 'Rate limit exceeded' };
    const client = setupMockClient([{ data: failedRow, error: null }]);
    const chain = createMockChain({ data: failedRow, error: null });
    client.from.mockReturnValue(chain);

    const result = await markFailed('action-1', 'Rate limit exceeded');

    expect(result.data?.status).toBe('failed');
    expect(result.data?.error).toBe('Rate limit exceeded');
    expect(chain.update).toHaveBeenCalledWith({
      status: 'failed',
      error: 'Rate limit exceeded',
    });
    expect(chain.eq).toHaveBeenCalledWith('id', 'action-1');
  });
});

// ─── markProcessed ──────────────────────────────────────────────────────────

describe('markProcessed', () => {
  it('sets processed=true', async () => {
    const client = setupMockClient([{ data: { ...QUEUED_ACTION, processed: true }, error: null }]);
    const chain = createMockChain({ data: { ...QUEUED_ACTION, processed: true }, error: null });
    client.from.mockReturnValue(chain);

    const result = await markProcessed('action-1');

    expect(result.data?.processed).toBe(true);
    expect(chain.update).toHaveBeenCalledWith({ processed: true });
  });
});

// ─── cancelByCampaign ───────────────────────────────────────────────────────

describe('cancelByCampaign', () => {
  it('updates all queued actions for the campaign to cancelled', async () => {
    const cancelledRows = [
      { ...QUEUED_ACTION, status: 'cancelled' },
      { ...QUEUED_ACTION, id: 'action-2', status: 'cancelled' },
    ];
    const client = setupMockClient([{ data: cancelledRows, error: null }]);
    const chain = createMockChain({ data: cancelledRows, error: null });
    client.from.mockReturnValue(chain);

    const result = await cancelByCampaign('campaign-1');

    expect(result.data).toHaveLength(2);
    expect(chain.update).toHaveBeenCalledWith({ status: 'cancelled' });
    expect(chain.eq).toHaveBeenCalledWith('source_campaign_id', 'campaign-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'queued');
  });

  it('returns empty array when no queued actions for campaign', async () => {
    setupMockClient([{ data: [], error: null }]);

    const result = await cancelByCampaign('campaign-empty');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });
});

// ─── cancelByLead ───────────────────────────────────────────────────────────

describe('cancelByLead', () => {
  it('cancels all queued actions for the lead', async () => {
    const client = setupMockClient([
      { data: [{ ...QUEUED_ACTION, status: 'cancelled' }], error: null },
    ]);
    const chain = createMockChain({
      data: [{ ...QUEUED_ACTION, status: 'cancelled' }],
      error: null,
    });
    client.from.mockReturnValue(chain);

    const result = await cancelByLead('lead-1');

    expect(chain.eq).toHaveBeenCalledWith('source_lead_id', 'lead-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'queued');
    expect(result.data).toHaveLength(1);
  });
});

// ─── getUnprocessedResults ──────────────────────────────────────────────────

describe('getUnprocessedResults', () => {
  it('queries for completed/failed unprocessed rows by lead', async () => {
    const rows = [{ ...QUEUED_ACTION, status: 'completed', processed: false }];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await getUnprocessedResults('lead-1');

    expect(result.data).toEqual(rows);
    expect(chain.eq).toHaveBeenCalledWith('source_lead_id', 'lead-1');
    expect(chain.in).toHaveBeenCalledWith('status', ['completed', 'failed']);
    expect(chain.eq).toHaveBeenCalledWith('processed', false);
  });
});

// ─── getUnprocessedResultsByCampaign ────────────────────────────────────────

describe('getUnprocessedResultsByCampaign', () => {
  it('queries by source_type, campaign, status, and processed', async () => {
    const rows = [{ ...QUEUED_ACTION, status: 'completed', processed: false }];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await getUnprocessedResultsByCampaign('outreach_campaign', 'campaign-1');

    expect(result.data).toEqual(rows);
    expect(chain.eq).toHaveBeenCalledWith('source_type', 'outreach_campaign');
    expect(chain.eq).toHaveBeenCalledWith('source_campaign_id', 'campaign-1');
    expect(chain.in).toHaveBeenCalledWith('status', ['completed', 'failed']);
    expect(chain.eq).toHaveBeenCalledWith('processed', false);
  });
});

// ─── hasPendingAction ───────────────────────────────────────────────────────

describe('hasPendingAction', () => {
  it('returns true when queued/executing actions exist', async () => {
    const client = setupMockClient([{ data: null, error: null, count: 2 }]);
    const chain = createMockChain({ data: null, error: null, count: 2 });
    // Override: the select call with head:true resolves directly, so mock then
    chain.then = jest.fn((resolve: (val: unknown) => void) =>
      resolve({ data: null, error: null, count: 2 })
    );
    client.from.mockReturnValue(chain);

    const result = await hasPendingAction('lead-1');

    expect(result).toBe(true);
  });

  it('returns false when no queued/executing actions exist', async () => {
    const client = setupMockClient([{ data: null, error: null, count: 0 }]);
    const chain = createMockChain({ data: null, error: null, count: 0 });
    chain.then = jest.fn((resolve: (val: unknown) => void) =>
      resolve({ data: null, error: null, count: 0 })
    );
    client.from.mockReturnValue(chain);

    const result = await hasPendingAction('lead-none');

    expect(result).toBe(false);
  });

  it('returns false when count is null (DB error)', async () => {
    const client = setupMockClient([{ data: null, error: { message: 'DB error' }, count: null }]);
    const chain = createMockChain({ data: null, error: { message: 'DB error' }, count: null });
    chain.then = jest.fn((resolve: (val: unknown) => void) =>
      resolve({ data: null, error: { message: 'DB error' }, count: null })
    );
    client.from.mockReturnValue(chain);

    const result = await hasPendingAction('lead-error');

    expect(result).toBe(false);
  });
});

// ─── getDistinctQueuedAccounts ──────────────────────────────────────────────

describe('getDistinctQueuedAccounts', () => {
  it('returns unique account/user pairs from queued actions', async () => {
    const rows = [
      { unipile_account_id: 'acc-1', user_id: 'user-1' },
      { unipile_account_id: 'acc-1', user_id: 'user-1' }, // duplicate
      { unipile_account_id: 'acc-2', user_id: 'user-2' },
    ];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await getDistinctQueuedAccounts();

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ unipile_account_id: 'acc-1', user_id: 'user-1' });
    expect(result[1]).toEqual({ unipile_account_id: 'acc-2', user_id: 'user-2' });
  });

  it('returns empty array on DB error', async () => {
    setupMockClient([{ data: null, error: { message: 'query failed' } }]);

    const result = await getDistinctQueuedAccounts();

    expect(result).toEqual([]);
  });

  it('returns empty array when no queued actions exist', async () => {
    setupMockClient([{ data: [], error: null }]);

    const result = await getDistinctQueuedAccounts();

    expect(result).toEqual([]);
  });
});

// ─── cleanupOldRows ─────────────────────────────────────────────────────────

describe('cleanupOldRows', () => {
  it('deletes processed terminal rows older than 7 days', async () => {
    const client = setupMockClient([{ data: null, error: null }]);
    const chain = createMockChain({ data: null, error: null });
    client.from.mockReturnValue(chain);

    const result = await cleanupOldRows();

    expect(result.error).toBeNull();
    expect(client.from).toHaveBeenCalledWith('linkedin_action_queue');
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.in).toHaveBeenCalledWith('status', ['completed', 'failed', 'cancelled']);
    expect(chain.eq).toHaveBeenCalledWith('processed', true);
    // lt called with 'created_at' and a cutoff ISO string
    expect(chain.lt).toHaveBeenCalledWith(
      'created_at',
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}/)
    );
  });

  it('returns error on DB failure', async () => {
    setupMockClient([{ data: null, error: { message: 'delete failed' } }]);

    const result = await cleanupOldRows();

    expect(result.error).toEqual({ message: 'delete failed' });
  });
});

// ─── insertActivityLog ──────────────────────────────────────────────────────

describe('insertActivityLog', () => {
  it('inserts into linkedin_activity_log and returns the row', async () => {
    setupMockClient([{ data: ACTIVITY_LOG_ROW, error: null }]);

    const result = await insertActivityLog({
      user_id: 'user-1',
      unipile_account_id: 'acc-1',
      action_type: 'connect',
      target_provider_id: 'prov-123',
      target_linkedin_url: 'https://linkedin.com/in/johndoe',
      source_type: 'outreach_campaign',
      source_campaign_id: 'campaign-1',
      source_lead_id: 'lead-1',
      payload: { message: 'Hello!' },
      result: { success: true },
    });

    expect(result.data).toEqual(ACTIVITY_LOG_ROW);
    expect(result.error).toBeNull();

    const client = (createSupabaseAdminClient as jest.Mock).mock.results[0].value;
    expect(client.from).toHaveBeenCalledWith('linkedin_activity_log');
  });

  it('coerces undefined optional fields to null', async () => {
    const client = setupMockClient([{ data: ACTIVITY_LOG_ROW, error: null }]);
    const chain = createMockChain({ data: ACTIVITY_LOG_ROW, error: null });
    client.from.mockReturnValue(chain);

    await insertActivityLog({
      user_id: 'user-1',
      unipile_account_id: 'acc-1',
      action_type: 'connect',
      source_type: 'outreach_campaign',
      source_campaign_id: 'campaign-1',
      source_lead_id: 'lead-1',
      payload: {},
      result: {},
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        target_provider_id: null,
        target_linkedin_url: null,
      })
    );
  });
});

// ─── listActivityLog ─────────────────────────────────────────────────────────

describe('listActivityLog', () => {
  it('returns all log entries ordered by created_at DESC when no filters', async () => {
    const rows = [ACTIVITY_LOG_ROW];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await listActivityLog();

    expect(result.data).toEqual(rows);
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    // No filter methods called
    expect(chain.eq).not.toHaveBeenCalled();
  });

  it('applies accountId filter', async () => {
    const client = setupMockClient([{ data: [ACTIVITY_LOG_ROW], error: null }]);
    const chain = createMockChain({ data: [ACTIVITY_LOG_ROW], error: null });
    client.from.mockReturnValue(chain);

    await listActivityLog({ accountId: 'acc-1' });

    expect(chain.eq).toHaveBeenCalledWith('unipile_account_id', 'acc-1');
  });

  it('applies actionType filter', async () => {
    const client = setupMockClient([{ data: [ACTIVITY_LOG_ROW], error: null }]);
    const chain = createMockChain({ data: [ACTIVITY_LOG_ROW], error: null });
    client.from.mockReturnValue(chain);

    await listActivityLog({ actionType: 'connect' });

    expect(chain.eq).toHaveBeenCalledWith('action_type', 'connect');
  });

  it('applies sourceCampaignId filter', async () => {
    const client = setupMockClient([{ data: [ACTIVITY_LOG_ROW], error: null }]);
    const chain = createMockChain({ data: [ACTIVITY_LOG_ROW], error: null });
    client.from.mockReturnValue(chain);

    await listActivityLog({ sourceCampaignId: 'campaign-1' });

    expect(chain.eq).toHaveBeenCalledWith('source_campaign_id', 'campaign-1');
  });

  it('applies since filter using gte', async () => {
    const client = setupMockClient([{ data: [ACTIVITY_LOG_ROW], error: null }]);
    const chain = createMockChain({ data: [ACTIVITY_LOG_ROW], error: null });
    client.from.mockReturnValue(chain);

    await listActivityLog({ since: '2026-03-01T00:00:00Z' });

    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-03-01T00:00:00Z');
  });

  it('applies limit and offset', async () => {
    const client = setupMockClient([{ data: [], error: null }]);
    const chain = createMockChain({ data: [], error: null });
    client.from.mockReturnValue(chain);

    await listActivityLog({ limit: 25, offset: 50 });

    expect(chain.limit).toHaveBeenCalledWith(25);
    expect(chain.range).toHaveBeenCalledWith(50, 74); // offset to offset + limit - 1
  });

  it('applies all filters together', async () => {
    const client = setupMockClient([{ data: [ACTIVITY_LOG_ROW], error: null }]);
    const chain = createMockChain({ data: [ACTIVITY_LOG_ROW], error: null });
    client.from.mockReturnValue(chain);

    await listActivityLog({
      accountId: 'acc-1',
      actionType: 'connect',
      since: '2026-03-01T00:00:00Z',
      sourceCampaignId: 'campaign-1',
      limit: 10,
    });

    expect(chain.eq).toHaveBeenCalledWith('unipile_account_id', 'acc-1');
    expect(chain.eq).toHaveBeenCalledWith('action_type', 'connect');
    expect(chain.eq).toHaveBeenCalledWith('source_campaign_id', 'campaign-1');
    expect(chain.gte).toHaveBeenCalledWith('created_at', '2026-03-01T00:00:00Z');
    expect(chain.limit).toHaveBeenCalledWith(10);
  });
});
