/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock Trigger.dev tasks
jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn(),
  },
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

// Mock team-integrations service
jest.mock('@/lib/services/team-integrations', () => ({
  verifyTeamMembership: jest.fn(),
}));

import { POST } from '@/app/api/content-pipeline/broadcast/route';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import { verifyTeamMembership } from '@/lib/services/team-integrations';
import { NextRequest } from 'next/server';

const mockAuth = auth as jest.Mock;
const mockCreateSupabase = createSupabaseAdminClient as jest.Mock;
const mockTrigger = tasks.trigger as jest.Mock;
const mockVerifyTeamMembership = verifyTeamMembership as jest.Mock;

// Valid UUIDs for Zod validation
const VALID_POST_ID = '11111111-1111-1111-1111-111111111111';
const VALID_PROFILE_1 = '22222222-2222-2222-2222-222222222222';
const VALID_PROFILE_2 = '33333333-3333-3333-3333-333333333333';
const VALID_TEAM_ID = '44444444-4444-4444-4444-444444444444';

function createMockSupabase() {
  type TableResult = { data: unknown; error: unknown };
  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};
    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.single = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: { message: 'Not found', code: 'PGRST116' } };
      return Promise.resolve(result);
    });

    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = tableResults[tableName] || { data: [], error: null };
        return Promise.resolve(result).then(onFulfilled, onRejected);
      },
      enumerable: false,
    });

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    setTableResult: (table: string, result: TableResult) => {
      tableResults[table] = result;
    },
  };
}

function createBroadcastRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/content-pipeline/broadcast', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Set up mocks for a successful broadcast (source post found, team membership OK) */
function setupSuccessMocks(mock: ReturnType<typeof createMockSupabase>) {
  mock.setTableResult('cp_pipeline_posts', {
    data: { team_profile_id: VALID_PROFILE_1 },
    error: null,
  });
  mock.setTableResult('team_profiles', {
    data: { team_id: VALID_TEAM_ID },
    error: null,
  });
  mockVerifyTeamMembership.mockResolvedValue({ authorized: true, team: { id: VALID_TEAM_ID, owner_id: 'user-1' } });
}

describe('POST /api/content-pipeline/broadcast', () => {
  let mock: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    mockCreateSupabase.mockReturnValue(mock.client);
  });

  it('returns 401 when unauthenticated', async () => {
    mockAuth.mockResolvedValue(null);

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
    });
    const response = await POST(request);

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 400 if source_post_id is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      target_profile_ids: [VALID_PROFILE_1],
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('returns 400 if target_profile_ids is missing', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('returns 400 if target_profile_ids is empty array', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [],
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('returns 400 if target_profile_ids is not an array', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: 'not-an-array',
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
    expect(data.issues).toBeDefined();
  });

  it('returns 400 if target_profile_ids contains non-UUID strings', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: ['not-a-uuid'],
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 403 when user is not a team member', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    mock.setTableResult('cp_pipeline_posts', {
      data: { team_profile_id: VALID_PROFILE_1 },
      error: null,
    });
    mock.setTableResult('team_profiles', {
      data: { team_id: VALID_TEAM_ID },
      error: null,
    });
    mockVerifyTeamMembership.mockResolvedValue({ authorized: false, error: 'Not a team member', status: 403 });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
    });
    const response = await POST(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe('Not a team member');
  });

  it('triggers broadcast task with correct payload', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    setupSuccessMocks(mock);
    mockTrigger.mockResolvedValue({ id: 'run-123' });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1, VALID_PROFILE_2],
      stagger_days: 3,
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(mockTrigger).toHaveBeenCalledWith('broadcast-post-variations', {
      sourcePostId: VALID_POST_ID,
      targetProfileIds: [VALID_PROFILE_1, VALID_PROFILE_2],
      userId: 'user-1',
      staggerDays: 3,
    });
  });

  it('returns success with run_id', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    setupSuccessMocks(mock);
    mockTrigger.mockResolvedValue({ id: 'run-abc-456' });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
    });
    const response = await POST(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.run_id).toBe('run-abc-456');
    expect(data.message).toContain('1 team member');
  });

  it('defaults stagger_days to 2 when not provided', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    setupSuccessMocks(mock);
    mockTrigger.mockResolvedValue({ id: 'run-123' });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
    });
    await POST(request);

    expect(mockTrigger).toHaveBeenCalledWith(
      'broadcast-post-variations',
      expect.objectContaining({ staggerDays: 2 })
    );
  });

  it('rejects stagger_days above max (Zod validation)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
      stagger_days: 10,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('rejects stagger_days below min (Zod validation)', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
      stagger_days: 0,
    });
    const response = await POST(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Validation failed');
  });

  it('returns 500 when task trigger fails', async () => {
    mockAuth.mockResolvedValue({ user: { id: 'user-1' } });
    setupSuccessMocks(mock);
    mockTrigger.mockRejectedValue(new Error('Trigger.dev connection failed'));

    const request = createBroadcastRequest({
      source_post_id: VALID_POST_ID,
      target_profile_ids: [VALID_PROFILE_1],
    });
    const response = await POST(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });
});
