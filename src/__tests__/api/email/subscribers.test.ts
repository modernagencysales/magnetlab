/**
 * @jest-environment node
 */

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase admin client
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock team context
jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn(),
}));

import { GET, POST } from '@/app/api/email/subscribers/route';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope } from '@/lib/utils/team-context';

// ---------------------------------------------------------------------------
// Mock Supabase builder
// ---------------------------------------------------------------------------

/**
 * Creates a mock Supabase client with independent chains per from() call.
 *
 * Each from() invocation produces a fresh chain whose terminal await resolves to
 * the result registered for that table via setResult(). Chain methods (select, eq,
 * etc.) are jest.fn() spies so assertions can inspect call args.
 *
 * The chain object is a "thenable" (has a .then method) so `await chain` works,
 * AND every chain method also returns the same thenable so chaining works:
 *   await supabase.from('t').select('*').eq('id', 1).order('x').range(0, 9)
 */
function createMockSupabase() {
  const tableResults: Record<
    string,
    { data: unknown; error: unknown; count?: number | null }
  > = {};

  // Track created chains so tests can inspect them
  const chains: Record<string, Record<string, jest.Mock>> = {};

  function createChain(table: string) {
    const resolve = () => {
      const result = tableResults[table] || { data: null, error: null, count: null };
      return Promise.resolve(result);
    };

    const chain: Record<string, unknown> = {
      then: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown,
      ) => resolve().then(onFulfilled, onRejected),
    };

    // Chain methods — each returns the same thenable/chainable object
    for (const method of [
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
      'single',
      'maybeSingle',
    ]) {
      chain[method] = jest.fn(() => chain);
    }

    // Store for assertions
    if (!chains[table]) {
      chains[table] = chain as Record<string, jest.Mock>;
    }

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => createChain(table)),
  };

  return {
    client,
    /** Register the result that awaiting a chain for `table` will resolve to. */
    setResult(
      table: string,
      result: { data: unknown; error: unknown; count?: number | null },
    ) {
      tableResults[table] = result;
    },
    /** Access chain spies for a given table (after from() has been called). */
    chains,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const TEST_USER_ID = 'user-abc-123';
const TEST_TEAM_ID = 'team-xyz-456';

function authenticatedSession() {
  return { user: { id: TEST_USER_ID, email: 'owner@test.com', name: 'Owner' } };
}

function teamScope() {
  return { type: 'team' as const, userId: TEST_USER_ID, teamId: TEST_TEAM_ID };
}

function noTeamScope() {
  return { type: 'user' as const, userId: TEST_USER_ID };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

let mock: ReturnType<typeof createMockSupabase>;

describe('Email Subscribers API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  // =========================================================================
  // GET /api/email/subscribers
  // =========================================================================

  describe('GET /api/email/subscribers', () => {
    it('returns 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new Request(
        'http://localhost:3000/api/email/subscribers?page=1&limit=10',
        { method: 'GET' },
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.code).toBe('UNAUTHORIZED');
    });

    it('returns subscribers list with pagination metadata', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      const subscribers = [
        {
          id: 'sub-1',
          team_id: TEST_TEAM_ID,
          email: 'alice@example.com',
          first_name: 'Alice',
          last_name: 'Smith',
          status: 'active',
          source: 'manual',
          source_id: null,
          subscribed_at: '2026-01-15T10:00:00Z',
          unsubscribed_at: null,
        },
        {
          id: 'sub-2',
          team_id: TEST_TEAM_ID,
          email: 'bob@example.com',
          first_name: 'Bob',
          last_name: null,
          status: 'active',
          source: 'lead_magnet',
          source_id: 'lm-1',
          subscribed_at: '2026-01-14T10:00:00Z',
          unsubscribed_at: null,
        },
      ];

      // The route fires two parallel queries (data + count) both on email_subscribers
      mock.setResult('email_subscribers', {
        data: subscribers,
        error: null,
        count: 25,
      });

      const request = new Request(
        'http://localhost:3000/api/email/subscribers?page=2&limit=10',
        { method: 'GET' },
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.subscribers).toEqual(subscribers);
      expect(json.total).toBe(25);
      expect(json.page).toBe(2);
      expect(json.limit).toBe(10);

      // Verify from() was called for email_subscribers (data query + count query)
      expect(mock.client.from).toHaveBeenCalledWith('email_subscribers');
      // At least two calls: one for data, one for count
      expect(mock.client.from.mock.calls.filter((c: string[]) => c[0] === 'email_subscribers').length).toBe(2);
    });

    it('applies search filter correctly', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      mock.setResult('email_subscribers', {
        data: [],
        error: null,
        count: 0,
      });

      const request = new Request(
        'http://localhost:3000/api/email/subscribers?search=alice&page=1&limit=50',
        { method: 'GET' },
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.subscribers).toEqual([]);

      // Verify that or() was called on both chains (data query and count query).
      // The route builds an ilike filter string containing the search term.
      const fromCalls = mock.client.from.mock.results;
      // Both chains should have had .or() called with the search filter
      for (const call of fromCalls) {
        const chain = call.value;
        expect(chain.or).toHaveBeenCalled();
        const orArg: string = chain.or.mock.calls[0][0];
        expect(orArg).toContain('%alice%');
        expect(orArg).toContain('email.ilike');
        expect(orArg).toContain('first_name.ilike');
        expect(orArg).toContain('last_name.ilike');
      }
    });

    it('applies status filter correctly', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      mock.setResult('email_subscribers', {
        data: [],
        error: null,
        count: 0,
      });

      const request = new Request(
        'http://localhost:3000/api/email/subscribers?status=unsubscribed&page=1&limit=50',
        { method: 'GET' },
      );
      const response = await GET(request);
      await response.json();

      expect(response.status).toBe(200);

      // Verify eq('status', 'unsubscribed') was called on both chains.
      // The first .eq('team_id', ...) is for team scoping; the second is for status filter.
      const fromCalls = mock.client.from.mock.results;
      for (const call of fromCalls) {
        const chain = call.value;
        // eq is called at least twice: once for team_id, once for status
        const eqCalls = chain.eq.mock.calls as [string, string][];
        const statusCall = eqCalls.find(
          ([col, val]: [string, string]) => col === 'status' && val === 'unsubscribed',
        );
        expect(statusCall).toBeDefined();
      }
    });

    it('rejects invalid status filter values', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      const request = new Request(
        'http://localhost:3000/api/email/subscribers?status=deleted&page=1&limit=50',
        { method: 'GET' },
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error).toBe('Invalid status filter');
    });

    it('returns validation error when user has no team', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(noTeamScope());

      const request = new Request(
        'http://localhost:3000/api/email/subscribers?page=1&limit=10',
        { method: 'GET' },
      );
      const response = await GET(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error).toBe('No team found for this user');
    });
  });

  // =========================================================================
  // POST /api/email/subscribers
  // =========================================================================

  describe('POST /api/email/subscribers', () => {
    it('returns 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new Request('http://localhost:3000/api/email/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(401);
      expect(json.code).toBe('UNAUTHORIZED');
    });

    it('creates a new subscriber with valid data (returns 201)', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      const createdSubscriber = {
        id: 'sub-new',
        team_id: TEST_TEAM_ID,
        email: 'newlead@example.com',
        first_name: 'John',
        last_name: null,
        status: 'active',
        source: 'manual',
        source_id: null,
        subscribed_at: '2026-02-19T12:00:00Z',
        unsubscribed_at: null,
      };

      // The route does:
      //   1. maybeSingle() — check for existing subscriber
      //   2. upsert().select().single() — create/update subscriber
      // Both hit email_subscribers. We set one result that satisfies both awaits.
      // For the "new subscriber" case, maybeSingle returns null (no existing),
      // and the upsert returns the created subscriber.
      //
      // Because our mock resolves the same result for all chains on the same table,
      // we need to track call order. The simplest approach: set a result that works
      // for the terminal await of each chain.
      //
      // The route calls maybeSingle() on the first chain (returns promise)
      // and single() on the second chain (returns promise).
      //
      // We'll use a counter approach: first from() call for existing check,
      // second for upsert.

      let callCount = 0;
      mock.client.from.mockImplementation((_table: string) => {
        callCount++;
        const existingCheckResult = { data: null, error: null };
        const upsertResult = { data: createdSubscriber, error: null };

        const currentResult = callCount === 1 ? existingCheckResult : upsertResult;

        const resolve = () => Promise.resolve(currentResult);

        const chain: Record<string, unknown> = {
          then: (
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => resolve().then(onFulfilled, onRejected),
        };

        for (const method of [
          'select', 'insert', 'upsert', 'update', 'delete',
          'eq', 'or', 'in', 'order', 'range', 'single', 'maybeSingle',
        ]) {
          chain[method] = jest.fn(() => chain);
        }

        return chain;
      });

      const request = new Request('http://localhost:3000/api/email/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email: 'newlead@example.com', first_name: 'John' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(201);
      expect(json.subscriber).toEqual(createdSubscriber);
      expect(json.subscriber.email).toBe('newlead@example.com');
      expect(json.subscriber.status).toBe('active');
      expect(json.subscriber.source).toBe('manual');
    });

    it('rejects invalid email format (returns 400)', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      const request = new Request('http://localhost:3000/api/email/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email: 'not-an-email' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error).toBe('Invalid email format');
    });

    it('rejects missing email (returns 400)', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      const request = new Request('http://localhost:3000/api/email/subscribers', {
        method: 'POST',
        body: JSON.stringify({ first_name: 'John' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
      // Zod will report "Required" for missing email field
      expect(json.details).toBeDefined();
    });

    it('email is lowercased and trimmed by the Zod schema', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(teamScope());

      const createdSubscriber = {
        id: 'sub-trimmed',
        team_id: TEST_TEAM_ID,
        email: 'upper@example.com',
        first_name: null,
        last_name: null,
        status: 'active',
        source: 'manual',
        source_id: null,
        subscribed_at: '2026-02-19T12:00:00Z',
        unsubscribed_at: null,
      };

      let capturedUpsertData: Record<string, unknown> | null = null;
      let callCount = 0;

      mock.client.from.mockImplementation(() => {
        callCount++;
        const existingCheckResult = { data: null, error: null };
        const upsertResult = { data: createdSubscriber, error: null };

        const currentResult = callCount === 1 ? existingCheckResult : upsertResult;

        const resolve = () => Promise.resolve(currentResult);

        const chain: Record<string, unknown> = {
          then: (
            onFulfilled?: (value: unknown) => unknown,
            onRejected?: (reason: unknown) => unknown,
          ) => resolve().then(onFulfilled, onRejected),
        };

        for (const method of [
          'select', 'insert', 'update', 'delete',
          'eq', 'or', 'in', 'order', 'range', 'single', 'maybeSingle',
        ]) {
          chain[method] = jest.fn(() => chain);
        }

        // Capture upsert data for assertion
        chain.upsert = jest.fn((data: Record<string, unknown>) => {
          capturedUpsertData = data;
          return chain;
        });

        return chain;
      });

      // Zod's .email() validator runs before .transform(), so leading/trailing
      // spaces would fail validation. Use mixed case only to test lowercasing.
      const request = new Request('http://localhost:3000/api/email/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email: 'UPPER@Example.COM' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      await response.json();

      expect(response.status).toBe(201);
      // The upsert should have received the lowercased email
      expect(capturedUpsertData).not.toBeNull();
      expect(capturedUpsertData!.email).toBe('upper@example.com');
    });

    it('returns validation error when user has no team', async () => {
      (auth as jest.Mock).mockResolvedValue(authenticatedSession());
      (getDataScope as jest.Mock).mockResolvedValue(noTeamScope());

      const request = new Request('http://localhost:3000/api/email/subscribers', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@example.com' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);
      const json = await response.json();

      expect(response.status).toBe(400);
      expect(json.code).toBe('VALIDATION_ERROR');
      expect(json.error).toBe('No team found for this user');
    });
  });
});
