/**
 * @jest-environment node
 */

import { POST } from '@/app/api/webhooks/resend/route';
import { NextRequest } from 'next/server';

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger to suppress output during tests
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client with chainable methods.
 * Each from() call creates an independent chain that resolves to configured data.
 */
function createMockSupabase() {
  const insertedRows: Array<Record<string, unknown>> = [];
  let leadLookupResult: { data: unknown; error: unknown } = { data: null, error: null };

  function createSelectChain() {
    const resolve = () => Promise.resolve(leadLookupResult);

    const chain: Record<string, unknown> = {
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    for (const method of ['select', 'eq', 'order', 'limit', 'single', 'in', 'gte']) {
      chain[method] = jest.fn(() => chain);
    }

    return chain;
  }

  function createInsertChain() {
    const resolve = () => Promise.resolve({ data: null, error: null });

    const chain: Record<string, unknown> = {
      then: (onFulfilled?: (value: unknown) => unknown, onRejected?: (reason: unknown) => unknown) => {
        return resolve().then(onFulfilled, onRejected);
      },
    };

    return chain;
  }

  const client = {
    from: jest.fn((table: string) => {
      if (table === 'funnel_leads') {
        return createSelectChain();
      }
      if (table === 'email_events') {
        return {
          insert: jest.fn((row: Record<string, unknown>) => {
            insertedRows.push(row);
            return createInsertChain();
          }),
        };
      }
      return createSelectChain();
    }),
  };

  return {
    client,
    insertedRows,
    setLeadResult: (result: { data: unknown; error: unknown }) => {
      leadLookupResult = result;
    },
  };
}

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost:3000/api/webhooks/resend', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/webhooks/resend', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  it('should process email.delivered event', async () => {
    mock.setLeadResult({
      data: {
        id: 'lead-1',
        user_id: 'user-1',
        lead_magnet_id: 'lm-1',
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        type: 'email.delivered',
        data: {
          email_id: 'resend-email-123',
          to: ['test@example.com'],
          subject: 'Welcome!',
          created_at: '2026-02-14T10:00:00Z',
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);

    // Verify an insert was made
    expect(mock.insertedRows).toHaveLength(1);
    expect(mock.insertedRows[0]).toMatchObject({
      email_id: 'resend-email-123',
      lead_id: 'lead-1',
      lead_magnet_id: 'lm-1',
      user_id: 'user-1',
      event_type: 'delivered',
      recipient_email: 'test@example.com',
      subject: 'Welcome!',
    });
  });

  it('should process email.opened event', async () => {
    mock.setLeadResult({
      data: {
        id: 'lead-2',
        user_id: 'user-1',
        lead_magnet_id: 'lm-2',
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        type: 'email.opened',
        data: {
          email_id: 'resend-email-456',
          to: ['reader@example.com'],
          subject: 'Check this out',
          created_at: '2026-02-14T12:00:00Z',
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mock.insertedRows).toHaveLength(1);
    expect(mock.insertedRows[0]).toMatchObject({
      event_type: 'opened',
      email_id: 'resend-email-456',
      recipient_email: 'reader@example.com',
    });
  });

  it('should process email.clicked event with link_url', async () => {
    mock.setLeadResult({
      data: {
        id: 'lead-3',
        user_id: 'user-1',
        lead_magnet_id: 'lm-1',
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        type: 'email.clicked',
        data: {
          email_id: 'resend-email-789',
          to: ['clicker@example.com'],
          subject: 'Click me',
          click: {
            link: 'https://example.com/offer',
            timestamp: '2026-02-14T14:00:00Z',
          },
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mock.insertedRows).toHaveLength(1);
    expect(mock.insertedRows[0]).toMatchObject({
      event_type: 'clicked',
      link_url: 'https://example.com/offer',
      recipient_email: 'clicker@example.com',
    });
  });

  it('should process email.bounced event with bounce_type', async () => {
    mock.setLeadResult({
      data: {
        id: 'lead-4',
        user_id: 'user-2',
        lead_magnet_id: null,
      },
      error: null,
    });

    const response = await POST(
      makeRequest({
        type: 'email.bounced',
        data: {
          email_id: 'resend-email-bounce',
          to: ['bounced@example.com'],
          subject: 'Delivery failed',
          bounce: {
            type: 'hard',
            message: 'Mailbox not found',
          },
        },
      })
    );

    expect(response.status).toBe(200);
    expect(mock.insertedRows).toHaveLength(1);
    expect(mock.insertedRows[0]).toMatchObject({
      event_type: 'bounced',
      bounce_type: 'hard',
      lead_magnet_id: null,
      recipient_email: 'bounced@example.com',
    });
  });

  it('should ignore unknown event types and return 200', async () => {
    const response = await POST(
      makeRequest({
        type: 'email.delivery_delayed',
        data: {
          email_id: 'resend-email-unknown',
          to: ['someone@example.com'],
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);

    // Should not have attempted any database operations
    expect(mock.insertedRows).toHaveLength(0);
  });

  it('should return 200 even when no matching lead found', async () => {
    mock.setLeadResult({ data: null, error: null });

    const response = await POST(
      makeRequest({
        type: 'email.delivered',
        data: {
          email_id: 'resend-email-no-lead',
          to: ['unknown@example.com'],
          subject: 'Hello',
        },
      })
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.received).toBe(true);

    // No insert should happen
    expect(mock.insertedRows).toHaveLength(0);
  });
});
