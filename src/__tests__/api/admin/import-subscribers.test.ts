/**
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { POST } from '@/app/api/admin/import-subscribers/route';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-abc-123';
const TEST_TEAM_ID = '11111111-1111-1111-1111-111111111111';
const OTHER_USER_ID = 'user-other-999';

function authenticatedSession(userId = TEST_USER_ID) {
  return { user: { id: userId, email: 'owner@test.com', name: 'Owner' } };
}

/**
 * Creates a mock Supabase client with call-order tracking.
 * `fromResults` maps call index to the result that chain resolves to.
 * Each from() returns an independent chain.
 */
function createMockSupabase(
  fromResults: Array<{ data: unknown; error: unknown; count?: number | null }>,
) {
  let callIndex = 0;
  const capturedUpserts: unknown[] = [];

  const client = {
    from: jest.fn(() => {
      const idx = callIndex++;
      const result = fromResults[idx] || { data: null, error: null, count: null };
      const resolve = () => Promise.resolve(result);

      const chain: Record<string, unknown> = {
        then: (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown,
        ) => resolve().then(onFulfilled, onRejected),
      };

      for (const method of [
        'select',
        'insert',
        'update',
        'delete',
        'eq',
        'or',
        'in',
        'order',
        'range',
        'single',
        'maybeSingle',
      ]) {
        chain[method] = jest.fn(() => chain);
      }

      chain.upsert = jest.fn((data: unknown) => {
        capturedUpserts.push(data);
        return chain;
      });

      return chain;
    }),
  };

  return { client, capturedUpserts };
}

function makeRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost:3000/api/admin/import-subscribers', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/admin/import-subscribers', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Auth
  // =========================================================================

  it('returns 401 when not authenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: 'email\ntest@x.com' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.code).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // Validation
  // =========================================================================

  it('returns 400 for invalid source', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const request = makeRequest({ source: 'invalid', teamId: TEST_TEAM_ID });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.error).toContain('Invalid source');
  });

  it('returns 400 for missing teamId', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const request = makeRequest({ source: 'csv', data: 'email\ntest@x.com' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.error).toContain('teamId');
  });

  it('returns 400 for invalid teamId format', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const request = makeRequest({ source: 'csv', teamId: 'not-a-uuid', data: 'email\ntest@x.com' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
  });

  // =========================================================================
  // Team ownership
  // =========================================================================

  it('returns 403 when team does not exist', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      // from('teams').select().eq().single() → not found
      { data: null, error: { message: 'not found' } },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest({
      source: 'csv',
      teamId: TEST_TEAM_ID,
      data: 'email\ntest@x.com',
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.code).toBe('FORBIDDEN');
  });

  it('returns 403 when user does not own the team', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      // Team exists but owned by someone else
      { data: { id: TEST_TEAM_ID, owner_id: OTHER_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest({
      source: 'csv',
      teamId: TEST_TEAM_ID,
      data: 'email\ntest@x.com',
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.code).toBe('FORBIDDEN');
  });

  // =========================================================================
  // Non-CSV sources (stubs)
  // =========================================================================

  it('returns 501 for resend source (not yet implemented)', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest({ source: 'resend', teamId: TEST_TEAM_ID });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(501);
    expect(json.message).toContain("'resend'");
    expect(json.message).toContain('not yet implemented');
  });

  it('returns 501 for positive_replies source', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest({ source: 'positive_replies', teamId: TEST_TEAM_ID });
    const response = await POST(request);

    expect(response.status).toBe(501);
  });

  it('returns 501 for purchasers source', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest({ source: 'purchasers', teamId: TEST_TEAM_ID });
    const response = await POST(request);

    expect(response.status).toBe(501);
  });

  // =========================================================================
  // CSV import — validation
  // =========================================================================

  it('returns 400 when CSV data is empty', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: '' });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.error).toContain('CSV data is required');
  });

  it('returns 400 when CSV has no email column', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = 'name,company\nAlice,Acme';
    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.error).toContain('email');
  });

  it('returns 400 when CSV has header only (no data rows)', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = 'email,first_name';
    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.code).toBe('VALIDATION_ERROR');
    expect(json.error).toContain('header row and at least one data row');
  });

  // =========================================================================
  // CSV import — success
  // =========================================================================

  it('imports valid CSV rows and returns counts', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      // from('teams') → team found, user is owner
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
      // from('email_subscribers').upsert() → success
      { data: null, error: null, count: 2 },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = [
      'email,first_name,last_name,company',
      'alice@example.com,Alice,Smith,Acme',
      'bob@example.com,Bob,Jones,Widgets Inc',
    ].join('\n');

    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.imported).toBe(2);
    expect(json.skipped).toBe(0);
    expect(json.total).toBe(2);

    // Verify upsert was called with correct data
    expect(mock.capturedUpserts.length).toBe(1);
    const upsertedRows = mock.capturedUpserts[0] as Array<Record<string, unknown>>;
    expect(upsertedRows).toHaveLength(2);
    expect(upsertedRows[0].email).toBe('alice@example.com');
    expect(upsertedRows[0].first_name).toBe('Alice');
    expect(upsertedRows[0].last_name).toBe('Smith');
    expect(upsertedRows[0].company).toBe('Acme');
    expect(upsertedRows[0].source).toBe('csv_import');
    expect(upsertedRows[0].team_id).toBe(TEST_TEAM_ID);
    expect(upsertedRows[1].email).toBe('bob@example.com');
  });

  it('deduplicates emails within the same CSV', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
      { data: null, error: null, count: 1 },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = [
      'email,first_name',
      'alice@example.com,Alice',
      'alice@example.com,Alice Duplicate',
    ].join('\n');

    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imported).toBe(1);
    expect(json.skipped).toBe(1);

    // Only one unique email should have been upserted
    const upsertedRows = mock.capturedUpserts[0] as Array<Record<string, unknown>>;
    expect(upsertedRows).toHaveLength(1);
    expect(upsertedRows[0].email).toBe('alice@example.com');
  });

  it('normalizes emails to lowercase', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
      { data: null, error: null, count: 1 },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = 'email\nALICE@EXAMPLE.COM';
    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imported).toBe(1);

    const upsertedRows = mock.capturedUpserts[0] as Array<Record<string, unknown>>;
    expect(upsertedRows[0].email).toBe('alice@example.com');
  });

  it('skips rows with invalid emails and reports count', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
      { data: null, error: null, count: 1 },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = [
      'email,first_name',
      'valid@example.com,Valid',
      'not-an-email,Invalid',
      ',EmptyEmail',
    ].join('\n');

    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imported).toBe(1);
    expect(json.skipped).toBe(2);
    expect(json.total).toBe(3);
    expect(json.errors).toBeDefined();
    expect(json.errors.length).toBe(1); // only the "not-an-email" gets reported, empty is just skipped
  });

  it('handles CSV with quoted fields', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
      { data: null, error: null, count: 1 },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = 'email,first_name,company\nalice@example.com,Alice,"Acme, Inc."';
    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.imported).toBe(1);

    const upsertedRows = mock.capturedUpserts[0] as Array<Record<string, unknown>>;
    expect(upsertedRows[0].company).toBe('Acme, Inc.');
  });

  it('returns 400 when all emails in CSV are invalid', async () => {
    (auth as jest.Mock).mockResolvedValue(authenticatedSession());

    const mock = createMockSupabase([
      { data: { id: TEST_TEAM_ID, owner_id: TEST_USER_ID }, error: null },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const csv = 'email\nnot-valid\nalso-bad';
    const request = makeRequest({ source: 'csv', teamId: TEST_TEAM_ID, data: csv });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('No valid email');
  });
});
