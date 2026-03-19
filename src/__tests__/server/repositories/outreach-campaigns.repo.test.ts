/**
 * @jest-environment node
 *
 * Tests for src/server/repositories/outreach-campaigns.repo.ts
 * All Supabase calls are mocked via createSupabaseAdminClient.
 */

import {
  createCampaign,
  getCampaign,
  listCampaigns,
  updateCampaign,
  deleteCampaign,
  listActiveCampaigns,
  getSteps,
  bulkAddLeads,
  getLead,
  updateLead,
  skipLead,
  getLeadsByStatus,
  getCampaignStats,
  getCampaignProgress,
} from '@/server/repositories/outreach-campaigns.repo';

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

// ─── Test data ───────────────────────────────────────────────────────────────

const CAMPAIGN = {
  id: 'campaign-1',
  user_id: 'user-1',
  team_id: null,
  name: 'Test Campaign',
  preset: 'warm_connect',
  unipile_account_id: 'acc-1',
  connect_message: 'Hi there!',
  first_message_template: 'Hey {{name}}, ...',
  follow_up_template: null,
  follow_up_delay_days: 3,
  withdraw_delay_days: 14,
  status: 'draft',
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

const STEP = {
  id: 'step-1',
  campaign_id: 'campaign-1',
  step_order: 1,
  action_type: 'view_profile',
  delay_days: 0,
  delay_hours: 0,
  trigger: 'previous_completed',
  config: {},
};

const LEAD = {
  id: 'lead-1',
  user_id: 'user-1',
  campaign_id: 'campaign-1',
  linkedin_url: 'https://linkedin.com/in/johndoe',
  linkedin_username: 'johndoe',
  unipile_provider_id: null,
  name: 'John Doe',
  company: 'Acme Inc',
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
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

const CREATE_INPUT = {
  name: 'Test Campaign',
  preset: 'warm_connect' as const,
  unipile_account_id: 'acc-1',
  first_message_template: 'Hey {{name}}, ...',
  connect_message: 'Hi there!',
};

// ─── createCampaign ──────────────────────────────────────────────────────────

describe('createCampaign', () => {
  it('inserts campaign and expands preset into steps, returns campaign row', async () => {
    // First from() = insert campaign, second from() = insert steps
    const client = setupMockClient([
      { data: CAMPAIGN, error: null },
      { data: null, error: null },
    ]);

    const result = await createCampaign('user-1', null, CREATE_INPUT);

    expect(result.data).toEqual(CAMPAIGN);
    expect(result.error).toBeNull();
    // Two DB calls: campaign insert + steps insert
    expect(client.from).toHaveBeenCalledTimes(2);
    expect(client.from).toHaveBeenNthCalledWith(1, 'outreach_campaigns');
    expect(client.from).toHaveBeenNthCalledWith(2, 'outreach_campaign_steps');
  });

  it('inserts correct preset steps for warm_connect (4 steps)', async () => {
    const client = setupMockClient([
      { data: CAMPAIGN, error: null },
      { data: null, error: null },
    ]);

    // Capture what gets inserted into steps
    const stepsChain = createMockChain({ data: null, error: null });
    let capturedSteps: unknown[] = [];
    stepsChain.insert = jest.fn((rows: unknown[]) => {
      capturedSteps = rows;
      return stepsChain;
    });
    client.from
      .mockReturnValueOnce(createMockChain({ data: CAMPAIGN, error: null }))
      .mockReturnValueOnce(stepsChain);

    await createCampaign('user-1', null, CREATE_INPUT);

    expect(capturedSteps).toHaveLength(4); // warm_connect has 4 steps
    expect(capturedSteps[0]).toMatchObject({
      campaign_id: 'campaign-1',
      step_order: 1,
      action_type: 'view_profile',
      config: {},
    });
    expect(capturedSteps[1]).toMatchObject({ step_order: 2, action_type: 'connect' });
    expect(capturedSteps[2]).toMatchObject({ step_order: 3, action_type: 'message' });
    expect(capturedSteps[3]).toMatchObject({ step_order: 4, action_type: 'follow_up_message' });
  });

  it('inserts nurture preset steps (4 steps with longer delays)', async () => {
    const client = setupMockClient([
      { data: { ...CAMPAIGN, preset: 'nurture' }, error: null },
      { data: null, error: null },
    ]);

    const stepsChain = createMockChain({ data: null, error: null });
    let capturedSteps: unknown[] = [];
    stepsChain.insert = jest.fn((rows: unknown[]) => {
      capturedSteps = rows;
      return stepsChain;
    });
    client.from
      .mockReturnValueOnce(
        createMockChain({ data: { ...CAMPAIGN, preset: 'nurture' }, error: null })
      )
      .mockReturnValueOnce(stepsChain);

    await createCampaign('user-1', null, { ...CREATE_INPUT, preset: 'nurture' });

    expect(capturedSteps).toHaveLength(4);
    // nurture: connect has delay_days=3
    expect(capturedSteps[1]).toMatchObject({ action_type: 'connect', delay_days: 3 });
  });

  it('returns null data when campaign insert fails', async () => {
    setupMockClient([{ data: null, error: { message: 'insert failed' } }]);

    const result = await createCampaign('user-1', null, CREATE_INPUT);

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: 'insert failed' });
  });

  it('sets correct defaults for optional fields', async () => {
    const client = setupMockClient([
      { data: CAMPAIGN, error: null },
      { data: null, error: null },
    ]);
    const chain = createMockChain({ data: CAMPAIGN, error: null });
    client.from
      .mockReturnValueOnce(chain)
      .mockReturnValue(createMockChain({ data: null, error: null }));

    await createCampaign('user-1', null, {
      name: 'Minimal',
      preset: 'direct_connect',
      unipile_account_id: 'acc-1',
      first_message_template: 'Hi!',
    });

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        connect_message: null,
        follow_up_template: null,
        follow_up_delay_days: 3,
        withdraw_delay_days: 14,
        status: 'draft',
      })
    );
  });
});

// ─── getCampaign ─────────────────────────────────────────────────────────────

describe('getCampaign', () => {
  it('returns single campaign scoped to userId', async () => {
    const client = setupMockClient([{ data: CAMPAIGN, error: null }]);
    const chain = createMockChain({ data: CAMPAIGN, error: null });
    client.from.mockReturnValue(chain);

    const result = await getCampaign('user-1', 'campaign-1');

    expect(result.data).toEqual(CAMPAIGN);
    expect(result.error).toBeNull();
    expect(chain.eq).toHaveBeenCalledWith('id', 'campaign-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.single).toHaveBeenCalled();
  });

  it('returns error when campaign not found', async () => {
    setupMockClient([{ data: null, error: { message: 'No rows found' } }]);

    const result = await getCampaign('user-1', 'missing');

    expect(result.data).toBeNull();
    expect(result.error).toEqual({ message: 'No rows found' });
  });
});

// ─── listCampaigns ───────────────────────────────────────────────────────────

describe('listCampaigns', () => {
  it('returns all campaigns for user ordered by created_at DESC', async () => {
    const campaigns = [CAMPAIGN, { ...CAMPAIGN, id: 'campaign-2' }];
    const client = setupMockClient([{ data: campaigns, error: null }]);
    const chain = createMockChain({ data: campaigns, error: null });
    client.from.mockReturnValue(chain);

    const result = await listCampaigns('user-1');

    expect(result.data).toEqual(campaigns);
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.eq).not.toHaveBeenCalledWith('status', expect.anything());
  });

  it('filters by status when provided', async () => {
    const client = setupMockClient([{ data: [CAMPAIGN], error: null }]);
    const chain = createMockChain({ data: [CAMPAIGN], error: null });
    client.from.mockReturnValue(chain);

    const result = await listCampaigns('user-1', 'active');

    expect(result.data).toHaveLength(1);
    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
  });

  it('returns empty array when user has no campaigns', async () => {
    setupMockClient([{ data: [], error: null }]);

    const result = await listCampaigns('user-nobody');

    expect(result.data).toEqual([]);
    expect(result.error).toBeNull();
  });
});

// ─── updateCampaign ──────────────────────────────────────────────────────────

describe('updateCampaign', () => {
  it('updates campaign with whitelisted fields only', async () => {
    const updated = { ...CAMPAIGN, name: 'New Name' };
    const client = setupMockClient([{ data: updated, error: null }]);
    const chain = createMockChain({ data: updated, error: null });
    client.from.mockReturnValue(chain);

    const result = await updateCampaign('user-1', 'campaign-1', { name: 'New Name' });

    expect(result.data?.name).toBe('New Name');
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('name', 'New Name');
    expect(updateArg).toHaveProperty('updated_at');
  });

  it('strips non-whitelisted fields from update', async () => {
    const client = setupMockClient([{ data: CAMPAIGN, error: null }]);
    const chain = createMockChain({ data: CAMPAIGN, error: null });
    client.from.mockReturnValue(chain);

    // Pass a field not in ALLOWED_CAMPAIGN_UPDATE_FIELDS
    await updateCampaign('user-1', 'campaign-1', {
      name: 'Good Field',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: 'active' as any, // not in update whitelist
    } as Parameters<typeof updateCampaign>[2]);

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg).toHaveProperty('name', 'Good Field');
    // status should NOT be passed through (not in ALLOWED_CAMPAIGN_UPDATE_FIELDS)
    expect(updateArg).not.toHaveProperty('status');
  });

  it('always sets updated_at timestamp', async () => {
    const client = setupMockClient([{ data: CAMPAIGN, error: null }]);
    const chain = createMockChain({ data: CAMPAIGN, error: null });
    client.from.mockReturnValue(chain);

    await updateCampaign('user-1', 'campaign-1', { name: 'Updated' });

    const updateArg = chain.update.mock.calls[0][0];
    expect(typeof updateArg.updated_at).toBe('string');
    expect(updateArg.updated_at).toMatch(/^\d{4}-\d{2}-\d{2}/);
  });

  it('scopes update to userId', async () => {
    const client = setupMockClient([{ data: CAMPAIGN, error: null }]);
    const chain = createMockChain({ data: CAMPAIGN, error: null });
    client.from.mockReturnValue(chain);

    await updateCampaign('user-1', 'campaign-1', { name: 'Updated' });

    expect(chain.eq).toHaveBeenCalledWith('id', 'campaign-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });
});

// ─── deleteCampaign ──────────────────────────────────────────────────────────

describe('deleteCampaign', () => {
  it('deletes campaign scoped to userId', async () => {
    const client = setupMockClient([{ data: null, error: null }]);
    const chain = createMockChain({ data: null, error: null });
    client.from.mockReturnValue(chain);

    const result = await deleteCampaign('user-1', 'campaign-1');

    expect(result.error).toBeNull();
    expect(chain.delete).toHaveBeenCalled();
    expect(chain.eq).toHaveBeenCalledWith('id', 'campaign-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
  });

  it('returns error on DB failure', async () => {
    setupMockClient([{ data: null, error: { message: 'FK violation' } }]);

    const result = await deleteCampaign('user-1', 'campaign-1');

    expect(result.error).toEqual({ message: 'FK violation' });
  });
});

// ─── listActiveCampaigns ─────────────────────────────────────────────────────

describe('listActiveCampaigns', () => {
  it('returns all active campaigns with no user filter', async () => {
    const activeCampaigns = [
      { ...CAMPAIGN, status: 'active' },
      { ...CAMPAIGN, id: 'campaign-2', user_id: 'user-2', status: 'active' },
    ];
    const client = setupMockClient([{ data: activeCampaigns, error: null }]);
    const chain = createMockChain({ data: activeCampaigns, error: null });
    client.from.mockReturnValue(chain);

    const result = await listActiveCampaigns();

    expect(result.data).toHaveLength(2);
    expect(chain.eq).toHaveBeenCalledWith('status', 'active');
    expect(chain.eq).not.toHaveBeenCalledWith('user_id', expect.anything());
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });
});

// ─── getSteps ─────────────────────────────────────────────────────────────────

describe('getSteps', () => {
  it('returns steps ordered by step_order ascending', async () => {
    const steps = [STEP, { ...STEP, id: 'step-2', step_order: 2, action_type: 'connect' }];
    const client = setupMockClient([{ data: steps, error: null }]);
    const chain = createMockChain({ data: steps, error: null });
    client.from.mockReturnValue(chain);

    const result = await getSteps('campaign-1');

    expect(result.data).toEqual(steps);
    expect(chain.eq).toHaveBeenCalledWith('campaign_id', 'campaign-1');
    expect(chain.order).toHaveBeenCalledWith('step_order', { ascending: true });
  });
});

// ─── bulkAddLeads ─────────────────────────────────────────────────────────────

describe('bulkAddLeads', () => {
  it('inserts leads and extracts linkedin_username from URL', async () => {
    // First from() = select existing URLs (empty), second = insert
    const client = setupMockClient([
      { data: [], error: null },
      { data: [{ id: 'lead-1' }, { id: 'lead-2' }], error: null },
    ]);

    const insertChain = createMockChain({
      data: [{ id: 'lead-1' }, { id: 'lead-2' }],
      error: null,
    });
    let capturedInsertRows: unknown[] = [];
    insertChain.insert = jest.fn((rows: unknown[]) => {
      capturedInsertRows = rows;
      return insertChain;
    });

    client.from
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain);

    const result = await bulkAddLeads('user-1', 'campaign-1', [
      { linkedin_url: 'https://linkedin.com/in/johndoe', name: 'John Doe' },
      { linkedin_url: 'https://linkedin.com/in/janesmith', name: 'Jane Smith' },
    ]);

    expect(result.inserted).toBe(2);
    expect(result.error).toBeNull();
    expect(capturedInsertRows).toHaveLength(2);
    expect((capturedInsertRows[0] as Record<string, unknown>).linkedin_username).toBe('johndoe');
    expect((capturedInsertRows[1] as Record<string, unknown>).linkedin_username).toBe('janesmith');
  });

  it('skips leads already in the campaign (dedup by linkedin_url)', async () => {
    // Existing: johndoe already in campaign
    const client = setupMockClient([
      { data: [{ linkedin_url: 'https://linkedin.com/in/johndoe' }], error: null },
      { data: [{ id: 'lead-new' }], error: null },
    ]);

    const insertChain = createMockChain({ data: [{ id: 'lead-new' }], error: null });
    let capturedInsertRows: unknown[] = [];
    insertChain.insert = jest.fn((rows: unknown[]) => {
      capturedInsertRows = rows;
      return insertChain;
    });

    client.from
      .mockReturnValueOnce(
        createMockChain({
          data: [{ linkedin_url: 'https://linkedin.com/in/johndoe' }],
          error: null,
        })
      )
      .mockReturnValueOnce(insertChain);

    await bulkAddLeads('user-1', 'campaign-1', [
      { linkedin_url: 'https://linkedin.com/in/johndoe' }, // dupe
      { linkedin_url: 'https://linkedin.com/in/newperson' }, // new
    ]);

    // Only the new person should be inserted
    expect(capturedInsertRows).toHaveLength(1);
    expect((capturedInsertRows[0] as Record<string, unknown>).linkedin_url).toBe(
      'https://linkedin.com/in/newperson'
    );
  });

  it('returns inserted=0 when all leads are duplicates', async () => {
    setupMockClient([{ data: [{ linkedin_url: 'https://linkedin.com/in/johndoe' }], error: null }]);

    const result = await bulkAddLeads('user-1', 'campaign-1', [
      { linkedin_url: 'https://linkedin.com/in/johndoe' },
    ]);

    expect(result.inserted).toBe(0);
    expect(result.error).toBeNull();
  });

  it('returns inserted=0 when leads array is empty', async () => {
    const result = await bulkAddLeads('user-1', 'campaign-1', []);
    expect(result.inserted).toBe(0);
    expect(result.error).toBeNull();
  });

  it('caps at 500 leads per call', async () => {
    const manyLeads = Array.from({ length: 600 }, (_, i) => ({
      linkedin_url: `https://linkedin.com/in/person${i}`,
    }));

    const client = setupMockClient([
      { data: [], error: null },
      { data: Array.from({ length: 500 }, (_, i) => ({ id: `lead-${i}` })), error: null },
    ]);

    const insertChain = createMockChain({
      data: Array.from({ length: 500 }, (_, i) => ({ id: `lead-${i}` })),
      error: null,
    });
    let capturedInsertRows: unknown[] = [];
    insertChain.insert = jest.fn((rows: unknown[]) => {
      capturedInsertRows = rows;
      return insertChain;
    });

    client.from
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain);

    await bulkAddLeads('user-1', 'campaign-1', manyLeads);

    expect(capturedInsertRows).toHaveLength(500);
  });

  it('sets status=pending and current_step_order=0 on inserted leads', async () => {
    const client = setupMockClient([
      { data: [], error: null },
      { data: [{ id: 'lead-1' }], error: null },
    ]);

    const insertChain = createMockChain({ data: [{ id: 'lead-1' }], error: null });
    let capturedInsertRows: unknown[] = [];
    insertChain.insert = jest.fn((rows: unknown[]) => {
      capturedInsertRows = rows;
      return insertChain;
    });

    client.from
      .mockReturnValueOnce(createMockChain({ data: [], error: null }))
      .mockReturnValueOnce(insertChain);

    await bulkAddLeads('user-1', 'campaign-1', [
      { linkedin_url: 'https://linkedin.com/in/johndoe' },
    ]);

    expect((capturedInsertRows[0] as Record<string, unknown>).status).toBe('pending');
    expect((capturedInsertRows[0] as Record<string, unknown>).current_step_order).toBe(0);
  });
});

// ─── getLeadsByStatus ─────────────────────────────────────────────────────────

describe('getLeadsByStatus', () => {
  it('filters by campaignId and status, ordered by created_at ASC', async () => {
    const pendingLeads = [LEAD, { ...LEAD, id: 'lead-2' }];
    const client = setupMockClient([{ data: pendingLeads, error: null }]);
    const chain = createMockChain({ data: pendingLeads, error: null });
    client.from.mockReturnValue(chain);

    const result = await getLeadsByStatus('campaign-1', 'pending');

    expect(result.data).toEqual(pendingLeads);
    expect(chain.eq).toHaveBeenCalledWith('campaign_id', 'campaign-1');
    expect(chain.eq).toHaveBeenCalledWith('status', 'pending');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: true });
  });

  it('applies limit when provided', async () => {
    const client = setupMockClient([{ data: [LEAD], error: null }]);
    const chain = createMockChain({ data: [LEAD], error: null });
    client.from.mockReturnValue(chain);

    await getLeadsByStatus('campaign-1', 'active', 10);

    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('does not apply limit when not provided', async () => {
    const client = setupMockClient([{ data: [LEAD], error: null }]);
    const chain = createMockChain({ data: [LEAD], error: null });
    client.from.mockReturnValue(chain);

    await getLeadsByStatus('campaign-1', 'pending');

    expect(chain.limit).not.toHaveBeenCalled();
  });
});

// ─── getCampaignStats ─────────────────────────────────────────────────────────

describe('getCampaignStats', () => {
  it('counts leads grouped by status and computes total', async () => {
    const rows = [
      { status: 'pending' },
      { status: 'pending' },
      { status: 'active' },
      { status: 'completed' },
      { status: 'replied' },
      { status: 'skipped' },
    ];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await getCampaignStats('campaign-1');

    expect(result.total).toBe(6);
    expect(result.pending).toBe(2);
    expect(result.active).toBe(1);
    expect(result.completed).toBe(1);
    expect(result.replied).toBe(1);
    expect(result.skipped).toBe(1);
    expect(result.withdrawn).toBe(0);
    expect(result.failed).toBe(0);
  });

  it('returns all-zero stats on DB error', async () => {
    setupMockClient([{ data: null, error: { message: 'query failed' } }]);

    const result = await getCampaignStats('campaign-1');

    expect(result).toEqual({
      total: 0,
      pending: 0,
      active: 0,
      completed: 0,
      replied: 0,
      withdrawn: 0,
      failed: 0,
      skipped: 0,
    });
  });

  it('returns all-zero stats when no leads exist', async () => {
    setupMockClient([{ data: [], error: null }]);

    const result = await getCampaignStats('campaign-empty');

    expect(result.total).toBe(0);
    expect(result.pending).toBe(0);
  });
});

// ─── getCampaignProgress ──────────────────────────────────────────────────────

describe('getCampaignProgress', () => {
  it('counts non-null timestamps for each stage', async () => {
    const rows = [
      {
        viewed_at: '2026-03-19T10:00:00Z',
        connect_sent_at: '2026-03-20T10:00:00Z',
        connected_at: '2026-03-21T10:00:00Z',
        messaged_at: '2026-03-21T10:30:00Z',
        follow_up_sent_at: null,
      },
      {
        viewed_at: '2026-03-19T11:00:00Z',
        connect_sent_at: '2026-03-20T11:00:00Z',
        connected_at: null,
        messaged_at: null,
        follow_up_sent_at: null,
      },
      {
        viewed_at: null,
        connect_sent_at: null,
        connected_at: null,
        messaged_at: null,
        follow_up_sent_at: null,
      },
    ];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await getCampaignProgress('campaign-1');

    expect(result.viewed).toBe(2);
    expect(result.connect_sent).toBe(2);
    expect(result.connected).toBe(1);
    expect(result.messaged).toBe(1);
    expect(result.follow_up_sent).toBe(0);
  });

  it('returns all-zero progress on DB error', async () => {
    setupMockClient([{ data: null, error: { message: 'query failed' } }]);

    const result = await getCampaignProgress('campaign-1');

    expect(result).toEqual({
      viewed: 0,
      connect_sent: 0,
      connected: 0,
      messaged: 0,
      follow_up_sent: 0,
    });
  });

  it('returns all-zero progress when no leads exist', async () => {
    setupMockClient([{ data: [], error: null }]);

    const result = await getCampaignProgress('campaign-empty');

    expect(result.viewed).toBe(0);
    expect(result.follow_up_sent).toBe(0);
  });
});

// ─── updateLead ───────────────────────────────────────────────────────────────

describe('updateLead', () => {
  it('updates specified fields and always sets updated_at', async () => {
    const updatedLead = { ...LEAD, status: 'active', viewed_at: '2026-03-19T10:05:00Z' };
    const client = setupMockClient([{ data: updatedLead, error: null }]);
    const chain = createMockChain({ data: updatedLead, error: null });
    client.from.mockReturnValue(chain);

    const result = await updateLead('lead-1', {
      status: 'active',
      viewed_at: '2026-03-19T10:05:00Z',
    });

    expect(result.data?.status).toBe('active');
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.status).toBe('active');
    expect(updateArg.viewed_at).toBe('2026-03-19T10:05:00Z');
    expect(typeof updateArg.updated_at).toBe('string');
  });

  it('uses provided updated_at when given', async () => {
    const client = setupMockClient([{ data: LEAD, error: null }]);
    const chain = createMockChain({ data: LEAD, error: null });
    client.from.mockReturnValue(chain);

    await updateLead('lead-1', { updated_at: '2026-03-19T12:00:00Z' });

    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.updated_at).toBe('2026-03-19T12:00:00Z');
  });
});

// ─── skipLead ─────────────────────────────────────────────────────────────────

describe('skipLead', () => {
  it('sets status=skipped and updated_at', async () => {
    const skippedLead = { ...LEAD, status: 'skipped' };
    const client = setupMockClient([{ data: skippedLead, error: null }]);
    const chain = createMockChain({ data: skippedLead, error: null });
    client.from.mockReturnValue(chain);

    const result = await skipLead('lead-1');

    expect(result.data?.status).toBe('skipped');
    const updateArg = chain.update.mock.calls[0][0];
    expect(updateArg.status).toBe('skipped');
    expect(typeof updateArg.updated_at).toBe('string');
    expect(chain.eq).toHaveBeenCalledWith('id', 'lead-1');
  });
});

// ─── getLead ──────────────────────────────────────────────────────────────────

describe('getLead', () => {
  it('returns single lead scoped to userId', async () => {
    const client = setupMockClient([{ data: LEAD, error: null }]);
    const chain = createMockChain({ data: LEAD, error: null });
    client.from.mockReturnValue(chain);

    const result = await getLead('user-1', 'lead-1');

    expect(result.data).toEqual(LEAD);
    expect(chain.eq).toHaveBeenCalledWith('id', 'lead-1');
    expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(chain.single).toHaveBeenCalled();
  });
});
