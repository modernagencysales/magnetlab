/**
 * @jest-environment node
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// --- Top-level mocks ---

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  requireTeamScope: jest.fn(),
}));

jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn().mockResolvedValue({ id: 'mock-run-id' }),
  },
}));

// Suppress console.error from logApiError internals
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

// --- Imports under test ---

import { POST as createFlow } from '@/app/api/email/flows/route';
import { PUT as updateFlow, DELETE as deleteFlow } from '@/app/api/email/flows/[id]/route';
import { POST as sendBroadcast } from '@/app/api/email/broadcasts/[id]/send/route';

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { tasks } from '@trigger.dev/sdk/v3';

// --- Mock helpers ---

const mockAuth = auth as jest.MockedFunction<typeof auth>;
const mockGetDataScope = requireTeamScope as jest.MockedFunction<typeof requireTeamScope>;
const mockCreateSupabaseAdminClient = createSupabaseAdminClient as jest.MockedFunction<
  typeof createSupabaseAdminClient
>;

function createMockSupabaseClient() {
  let callIndex = 0;
  const responses: Array<{ data: any; error: any; count?: number | null }> = [];

  function addResponse(data: any, error: any = null, count?: number | null) {
    responses.push({ data, error, count: count ?? null });
  }

  function getNextResponse() {
    const resp = responses[callIndex] || { data: null, error: null, count: null };
    callIndex++;
    return resp;
  }

  const chain: any = {};
  const chainMethods = [
    'select',
    'insert',
    'upsert',
    'update',
    'delete',
    'eq',
    'or',
    'in',
    'order',
    'range',
    'limit',
  ];
  for (const method of chainMethods) {
    chain[method] = jest.fn().mockReturnValue(chain);
  }
  chain.single = jest.fn().mockImplementation(() => Promise.resolve(getNextResponse()));
  chain.maybeSingle = jest.fn().mockImplementation(() => Promise.resolve(getNextResponse()));

  // Make chain itself thenable (for queries without .single()/.maybeSingle())
  Object.defineProperty(chain, 'then', {
    get: () => (resolve: any, reject: any) =>
      Promise.resolve(getNextResponse()).then(resolve, reject),
  });

  return {
    from: jest.fn().mockReturnValue(chain),
    rpc: jest.fn().mockImplementation(() => Promise.resolve(getNextResponse())),
    _chain: chain,
    addResponse,
    reset: () => {
      callIndex = 0;
      responses.length = 0;
    },
  };
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makePutRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeDeleteRequest(): Request {
  return new Request('http://localhost:3000/api/test', {
    method: 'DELETE',
  });
}

const VALID_UUID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

// --- Setup authenticated session ---

function setupAuth() {
  mockAuth.mockResolvedValue({ user: { id: 'user-123' } } as any);
  mockGetDataScope.mockResolvedValue({ type: 'team', teamId: 'team-123' } as any);
}

function setupUnauthenticated() {
  mockAuth.mockResolvedValue(null as any);
}

// ============================================================================
// FLOW API TESTS
// ============================================================================

describe('POST /api/email/flows (create)', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
    mockCreateSupabaseAdminClient.mockReturnValue(mockClient as any);
  });

  it('returns 401 when not authenticated', async () => {
    setupUnauthenticated();

    const request = makeRequest({ name: 'Test Flow', trigger_type: 'manual' });
    const response = await createFlow(request);
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('creates a manual flow with valid data (returns 201)', async () => {
    setupAuth();

    const flowData = {
      id: VALID_UUID,
      team_id: 'team-123',
      user_id: 'user-123',
      name: 'Welcome Flow',
      description: 'A welcome flow for new subscribers',
      trigger_type: 'manual',
      trigger_lead_magnet_id: null,
      status: 'draft',
      created_at: '2026-02-19T00:00:00Z',
      updated_at: '2026-02-19T00:00:00Z',
    };

    // The insert().select().single() call
    mockClient.addResponse(flowData);

    const request = makeRequest({
      name: 'Welcome Flow',
      description: 'A welcome flow for new subscribers',
      trigger_type: 'manual',
    });
    const response = await createFlow(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.flow).toBeDefined();
    expect(body.flow.name).toBe('Welcome Flow');
    expect(body.flow.trigger_type).toBe('manual');
    expect(body.flow.status).toBe('draft');

    // Verify supabase was called with correct table
    expect(mockClient.from).toHaveBeenCalledWith('email_flows');
    expect(mockClient._chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'team-123',
        user_id: 'user-123',
        name: 'Welcome Flow',
        trigger_type: 'manual',
        status: 'draft',
      })
    );
  });

  it('rejects empty name (Zod validation error, 400)', async () => {
    setupAuth();

    const request = makeRequest({ name: '', trigger_type: 'manual' });
    const response = await createFlow(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/Name is required/i);
  });

  it('rejects lead_magnet trigger without trigger_lead_magnet_id (400)', async () => {
    setupAuth();

    const request = makeRequest({
      name: 'LM Flow',
      trigger_type: 'lead_magnet',
    });
    const response = await createFlow(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/trigger_lead_magnet_id is required/i);
  });

  it('creates a lead_magnet trigger flow when lead magnet exists', async () => {
    setupAuth();

    const leadMagnetId = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';

    // Response 1: lead_magnets lookup -> found
    mockClient.addResponse({ id: leadMagnetId });

    // Response 2: email_flows insert -> created flow
    const flowData = {
      id: VALID_UUID,
      team_id: 'team-123',
      user_id: 'user-123',
      name: 'LM Triggered Flow',
      description: null,
      trigger_type: 'lead_magnet',
      trigger_lead_magnet_id: leadMagnetId,
      status: 'draft',
      created_at: '2026-02-19T00:00:00Z',
      updated_at: '2026-02-19T00:00:00Z',
    };
    mockClient.addResponse(flowData);

    const request = makeRequest({
      name: 'LM Triggered Flow',
      trigger_type: 'lead_magnet',
      trigger_lead_magnet_id: leadMagnetId,
    });
    const response = await createFlow(request);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.flow).toBeDefined();
    expect(body.flow.trigger_type).toBe('lead_magnet');
    expect(body.flow.trigger_lead_magnet_id).toBe(leadMagnetId);
    expect(body.flow.status).toBe('draft');

    // Verify lead_magnets table was queried
    expect(mockClient.from).toHaveBeenCalledWith('lead_magnets');
    expect(mockClient._chain.eq).toHaveBeenCalledWith('id', leadMagnetId);
    expect(mockClient._chain.eq).toHaveBeenCalledWith('user_id', 'user-123');
  });
});

// ============================================================================

describe('PUT /api/email/flows/[id] (update)', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
    mockCreateSupabaseAdminClient.mockReturnValue(mockClient as any);
  });

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it('returns 401 when not authenticated', async () => {
    setupUnauthenticated();

    const request = makePutRequest({ name: 'Updated Name' });
    const response = await updateFlow(request as any, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects activation when flow has 0 steps (400)', async () => {
    setupAuth();

    // Response 1: fetch existing flow -> found, status=draft
    mockClient.addResponse({
      id: VALID_UUID,
      status: 'draft',
      trigger_type: 'manual',
    });

    // Response 2: step count query (thenable, not .single()) -> count: 0
    mockClient.addResponse(null, null, 0);

    const request = makePutRequest({ status: 'active' });
    const response = await updateFlow(request as any, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/must have at least 1 step/i);
  });

  it('allows activation when flow has steps', async () => {
    setupAuth();

    // Response 1: fetch existing flow -> found, status=draft
    mockClient.addResponse({
      id: VALID_UUID,
      status: 'draft',
      trigger_type: 'manual',
    });

    // Response 2: step count query -> count: 3
    mockClient.addResponse(null, null, 3);

    // Response 3: update -> updated flow
    const updatedFlow = {
      id: VALID_UUID,
      team_id: 'team-123',
      user_id: 'user-123',
      name: 'Active Flow',
      description: null,
      trigger_type: 'manual',
      trigger_lead_magnet_id: null,
      status: 'active',
      created_at: '2026-02-19T00:00:00Z',
      updated_at: '2026-02-19T01:00:00Z',
    };
    mockClient.addResponse(updatedFlow);

    const request = makePutRequest({ status: 'active' });
    const response = await updateFlow(request as any, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.flow).toBeDefined();
    expect(body.flow.status).toBe('active');
  });
});

// ============================================================================

describe('DELETE /api/email/flows/[id]', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
    mockCreateSupabaseAdminClient.mockReturnValue(mockClient as any);
  });

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it('returns 404 when flow not found', async () => {
    setupAuth();

    // Response 1: fetch flow -> not found
    mockClient.addResponse(null, { message: 'Not found', code: 'PGRST116' });

    const request = makeDeleteRequest();
    const response = await deleteFlow(request as any, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.code).toBe('NOT_FOUND');
    expect(body.error).toMatch(/Flow not found/i);
  });

  it('rejects deleting active flow (400, "only draft or paused")', async () => {
    setupAuth();

    // Response 1: fetch flow -> found, status=active
    mockClient.addResponse({ id: VALID_UUID, status: 'active' });

    const request = makeDeleteRequest();
    const response = await deleteFlow(request as any, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/only draft or paused/i);
  });

  it('deletes draft flow successfully (204)', async () => {
    setupAuth();

    // Response 1: fetch flow -> found, status=draft
    mockClient.addResponse({ id: VALID_UUID, status: 'draft' });

    // Response 2: delete -> success (thenable chain, no .single())
    mockClient.addResponse(null, null);

    const request = makeDeleteRequest();
    const response = await deleteFlow(request as any, makeParams(VALID_UUID));

    expect(response.status).toBe(204);

    // Verify delete was called on the correct table
    expect(mockClient.from).toHaveBeenCalledWith('email_flows');
    expect(mockClient._chain.delete).toHaveBeenCalled();
    expect(mockClient._chain.eq).toHaveBeenCalledWith('id', VALID_UUID);
  });
});

// ============================================================================
// BROADCAST API TESTS
// ============================================================================

describe('POST /api/email/broadcasts/[id]/send', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockClient = createMockSupabaseClient();
    mockCreateSupabaseAdminClient.mockReturnValue(mockClient as any);
  });

  function makeParams(id: string) {
    return { params: Promise.resolve({ id }) };
  }

  it('returns 401 when not authenticated', async () => {
    setupUnauthenticated();

    const request = new Request('http://localhost:3000/api/email/broadcasts/test/send', {
      method: 'POST',
    });
    const response = await sendBroadcast(request, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toBe('Unauthorized');
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('rejects sending non-draft broadcast (400)', async () => {
    setupAuth();

    // Response 1: fetch broadcast -> found, status=sent
    mockClient.addResponse({
      id: VALID_UUID,
      team_id: 'team-123',
      subject: 'Newsletter',
      body: '<p>Content here</p>',
      status: 'sent',
      audience_filter: {},
    });

    const request = new Request('http://localhost:3000/api/email/broadcasts/test/send', {
      method: 'POST',
    });
    const response = await sendBroadcast(request, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/only draft broadcasts can be sent/i);
  });

  it('rejects broadcast with empty subject (400)', async () => {
    setupAuth();

    // Response 1: fetch broadcast -> draft with empty subject
    mockClient.addResponse({
      id: VALID_UUID,
      team_id: 'team-123',
      subject: '',
      body: '<p>Content here</p>',
      status: 'draft',
      audience_filter: {},
    });

    const request = new Request('http://localhost:3000/api/email/broadcasts/test/send', {
      method: 'POST',
    });
    const response = await sendBroadcast(request, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/must have a subject/i);
  });

  it('rejects broadcast with empty body (400)', async () => {
    setupAuth();

    // Response 1: fetch broadcast -> draft with empty body
    mockClient.addResponse({
      id: VALID_UUID,
      team_id: 'team-123',
      subject: 'Newsletter',
      body: '',
      status: 'draft',
      audience_filter: {},
    });

    const request = new Request('http://localhost:3000/api/email/broadcasts/test/send', {
      method: 'POST',
    });
    const response = await sendBroadcast(request, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/must have a body/i);
  });

  it('rejects when 0 subscribers match filter (400)', async () => {
    setupAuth();

    // Response 1: fetch broadcast -> valid draft
    mockClient.addResponse({
      id: VALID_UUID,
      team_id: 'team-123',
      subject: 'Newsletter',
      body: '<p>Content here</p>',
      status: 'draft',
      audience_filter: { tag: 'vip' },
    });

    // Response 2: rpc get_filtered_subscriber_count -> 0
    mockClient.addResponse(0);

    const request = new Request('http://localhost:3000/api/email/broadcasts/test/send', {
      method: 'POST',
    });
    const response = await sendBroadcast(request, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.error).toMatch(/no subscribers match/i);
  });

  it('successfully queues broadcast for sending (returns 200 with recipient_count)', async () => {
    setupAuth();

    // Response 1: fetch broadcast -> valid draft
    mockClient.addResponse({
      id: VALID_UUID,
      team_id: 'team-123',
      subject: 'Monthly Newsletter',
      body: '<p>Hello subscribers!</p>',
      status: 'draft',
      audience_filter: {},
    });

    // Response 2: rpc get_filtered_subscriber_count -> 42
    mockClient.addResponse(42);

    // Response 3: update broadcast status to 'sending' (thenable, no .single())
    mockClient.addResponse(null, null);

    const request = new Request('http://localhost:3000/api/email/broadcasts/test/send', {
      method: 'POST',
    });
    const response = await sendBroadcast(request, makeParams(VALID_UUID));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.message).toBe('Broadcast queued for sending');
    expect(body.recipient_count).toBe(42);

    // Verify Trigger.dev task was triggered
    expect(tasks.trigger).toHaveBeenCalledWith('send-broadcast', {
      broadcast_id: VALID_UUID,
      team_id: 'team-123',
      user_id: 'user-123',
    });

    // Verify broadcast status was updated
    expect(mockClient._chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'sending',
        recipient_count: 42,
      })
    );

    // Verify RPC was called with correct params
    expect(mockClient.rpc).toHaveBeenCalledWith('get_filtered_subscriber_count', {
      p_team_id: 'team-123',
      p_filter: {},
    });
  });
});
