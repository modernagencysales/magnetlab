/**
 * @jest-environment node
 */

// ---------------------------------------------------------------------------
// Mocks — must be declared before imports
// ---------------------------------------------------------------------------

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

import { POST } from '@/app/api/webhooks/subscriber-sync/route';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_TEAM_ID = '11111111-1111-1111-1111-111111111111';
const WEBHOOK_SECRET = 'test-webhook-secret-abc123';

// Set env var for the tests
beforeAll(() => {
  process.env.SUBSCRIBER_SYNC_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

afterAll(() => {
  delete process.env.SUBSCRIBER_SYNC_WEBHOOK_SECRET;
});

/**
 * Creates a mock Supabase client with call-order tracking.
 */
function createMockSupabase(
  fromResults: Array<{ data: unknown; error: unknown }>,
) {
  let callIndex = 0;
  const capturedUpserts: unknown[] = [];

  const client = {
    from: jest.fn(() => {
      const idx = callIndex++;
      const result = fromResults[idx] || { data: null, error: null };
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

function makeRequest(
  body: Record<string, unknown>,
  headers: Record<string, string> = {},
): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/subscriber-sync', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('POST /api/webhooks/subscriber-sync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // Auth
  // =========================================================================

  it('returns 401 when webhook secret is missing', async () => {
    const request = makeRequest({
      email: 'test@example.com',
      team_id: TEST_TEAM_ID,
    });
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  it('returns 401 when webhook secret is wrong', async () => {
    const request = makeRequest(
      { email: 'test@example.com', team_id: TEST_TEAM_ID },
      { 'x-webhook-secret': 'wrong-secret' },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe('Unauthorized');
  });

  // =========================================================================
  // Validation
  // =========================================================================

  it('returns 400 when email is missing', async () => {
    const request = makeRequest(
      { team_id: TEST_TEAM_ID },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('email');
  });

  it('returns 400 when team_id is missing', async () => {
    const request = makeRequest(
      { email: 'test@example.com' },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('team_id');
  });

  it('returns 400 for invalid email format', async () => {
    const request = makeRequest(
      { email: 'not-valid', team_id: TEST_TEAM_ID },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('email');
  });

  it('returns 400 for invalid team_id format', async () => {
    const request = makeRequest(
      { email: 'test@example.com', team_id: 'bad-uuid' },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('team_id');
  });

  it('returns 400 for invalid source', async () => {
    const request = makeRequest(
      { email: 'test@example.com', team_id: TEST_TEAM_ID, source: 'invalid_source' },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain('Invalid source');
  });

  // =========================================================================
  // Successful sync — new subscriber
  // =========================================================================

  it('creates a new subscriber with valid payload', async () => {
    const mock = createMockSupabase([
      // from('email_subscribers').select().eq().eq().maybeSingle() → no existing
      { data: null, error: null },
      // from('email_subscribers').upsert().select().single() → created
      {
        data: {
          id: 'sub-new',
          email: 'lead@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          company: 'Acme',
          source: 'positive_reply',
          status: 'active',
        },
        error: null,
      },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest(
      {
        email: 'Lead@Example.com',
        first_name: 'Jane',
        last_name: 'Doe',
        company: 'Acme',
        source: 'positive_reply',
        team_id: TEST_TEAM_ID,
        metadata: { reply_campaign: 'heyreach-123' },
      },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.subscriber).toBeDefined();
    expect(json.subscriber.email).toBe('lead@example.com');
    expect(json.merged).toBe(false);

    // Verify upsert was called with normalized email
    expect(mock.capturedUpserts.length).toBe(1);
    const upserted = mock.capturedUpserts[0] as Record<string, unknown>;
    expect(upserted.email).toBe('lead@example.com');
    expect(upserted.source).toBe('positive_reply');
    expect(upserted.first_name).toBe('Jane');
    expect(upserted.company).toBe('Acme');
  });

  it('defaults source to gtm_sync when not provided', async () => {
    const mock = createMockSupabase([
      { data: null, error: null },
      {
        data: {
          id: 'sub-new',
          email: 'test@example.com',
          first_name: null,
          last_name: null,
          company: null,
          source: 'gtm_sync',
          status: 'active',
        },
        error: null,
      },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest(
      { email: 'test@example.com', team_id: TEST_TEAM_ID },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);

    const upserted = mock.capturedUpserts[0] as Record<string, unknown>;
    expect(upserted.source).toBe('gtm_sync');
  });

  // =========================================================================
  // Successful sync — upsert existing subscriber (merge)
  // =========================================================================

  it('upserts and merges with existing subscriber (keep richest)', async () => {
    const mock = createMockSupabase([
      // Existing subscriber found
      {
        data: {
          id: 'sub-existing',
          first_name: 'Jane',
          last_name: 'Doe',
          company: 'Old Corp',
          metadata: { original_source: 'heyreach' },
        },
        error: null,
      },
      // Upsert result
      {
        data: {
          id: 'sub-existing',
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          company: 'New Corp',
          source: 'positive_reply',
          status: 'active',
        },
        error: null,
      },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest(
      {
        email: 'jane@example.com',
        team_id: TEST_TEAM_ID,
        company: 'New Corp',
        source: 'positive_reply',
        metadata: { meeting_date: '2026-02-23' },
      },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.success).toBe(true);
    expect(json.merged).toBe(true);

    // Verify merge logic: new company replaces old, existing names kept
    const upserted = mock.capturedUpserts[0] as Record<string, unknown>;
    expect(upserted.first_name).toBe('Jane'); // kept from existing
    expect(upserted.last_name).toBe('Doe'); // kept from existing
    expect(upserted.company).toBe('New Corp'); // updated from payload

    // Metadata should be merged
    const metadata = upserted.metadata as Record<string, unknown>;
    expect(metadata.original_source).toBe('heyreach'); // from existing
    expect(metadata.meeting_date).toBe('2026-02-23'); // from payload
  });

  it('keeps existing names when payload names are empty', async () => {
    const mock = createMockSupabase([
      {
        data: {
          id: 'sub-existing',
          first_name: 'Jane',
          last_name: 'Doe',
          company: 'Acme',
          metadata: {},
        },
        error: null,
      },
      {
        data: {
          id: 'sub-existing',
          email: 'jane@example.com',
          first_name: 'Jane',
          last_name: 'Doe',
          company: 'Acme',
          source: 'gtm_sync',
          status: 'active',
        },
        error: null,
      },
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    // Payload has no names or company — should keep existing
    const request = makeRequest(
      { email: 'jane@example.com', team_id: TEST_TEAM_ID },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.merged).toBe(true);

    const upserted = mock.capturedUpserts[0] as Record<string, unknown>;
    expect(upserted.first_name).toBe('Jane');
    expect(upserted.last_name).toBe('Doe');
    expect(upserted.company).toBe('Acme');
  });

  // =========================================================================
  // Error handling
  // =========================================================================

  it('returns 500 when upsert fails', async () => {
    const mock = createMockSupabase([
      { data: null, error: null }, // no existing
      { data: null, error: { message: 'constraint violation' } }, // upsert fails
    ]);
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    const request = makeRequest(
      { email: 'test@example.com', team_id: TEST_TEAM_ID },
      { 'x-webhook-secret': WEBHOOK_SECRET },
    );
    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toContain('Failed to sync');
  });
});
