/**
 * @jest-environment node
 */

import { NextRequest } from 'next/server';

// Mock Trigger.dev tasks — must use jest.fn() inline to avoid hoisting issues
jest.mock('@trigger.dev/sdk/v3', () => ({
  tasks: {
    trigger: jest.fn().mockResolvedValue({ id: 'run-123' }),
  },
}));

// Get reference to the mock after setup
import { tasks } from '@trigger.dev/sdk/v3';
const mockTrigger = tasks.trigger as jest.Mock;

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

/**
 * Creates a mock Supabase client that handles sequential from() calls:
 * 1st call: user_integrations lookup (select → eq → eq → single)
 * 2nd call: cp_call_transcripts dedup check (select → eq → eq → maybeSingle)
 * 3rd call: cp_call_transcripts insert (insert → select → single)
 */
function createMockSupabase(options: {
  integration?: { webhook_secret: string; is_active: boolean } | null;
  integrationError?: { message: string } | null;
  existingTranscript?: { id: string } | null;
  insertedTranscript?: { id: string } | null;
  insertError?: { message: string } | null;
}) {
  let callCount = 0;

  const client = {
    from: jest.fn(() => {
      callCount++;
      const currentCall = callCount;

      if (currentCall === 1) {
        // user_integrations lookup
        const result = {
          data: options.integration ?? null,
          error: options.integrationError ?? null,
        };
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.single = jest.fn(() => Promise.resolve(result));
        return chain;
      }

      if (currentCall === 2) {
        // cp_call_transcripts dedup check
        const result = {
          data: options.existingTranscript ?? null,
          error: null,
        };
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.maybeSingle = jest.fn(() => Promise.resolve(result));
        return chain;
      }

      if (currentCall === 3) {
        // cp_call_transcripts insert
        const result = {
          data: options.insertedTranscript ?? null,
          error: options.insertError ?? null,
        };
        const chain: Record<string, jest.Mock> = {};
        chain.insert = jest.fn(() => chain);
        chain.select = jest.fn(() => chain);
        chain.single = jest.fn(() => Promise.resolve(result));
        return chain;
      }

      // Fallback
      const chain: Record<string, jest.Mock> = {};
      chain.select = jest.fn(() => chain);
      chain.eq = jest.fn(() => chain);
      chain.single = jest.fn(() => Promise.resolve({ data: null, error: null }));
      chain.maybeSingle = jest.fn(() => Promise.resolve({ data: null, error: null }));
      chain.insert = jest.fn(() => chain);
      return chain;
    }),
  };

  return client;
}

function makeRequest(
  userId: string,
  body: Record<string, unknown>,
  secret?: string
): NextRequest {
  const url = new URL(`http://localhost:3000/api/webhooks/fathom/${userId}`);
  if (secret) {
    url.searchParams.set('secret', secret);
  }
  return new NextRequest(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Import after mocks are set up
import { POST } from '@/app/api/webhooks/fathom/[userId]/route';

describe('POST /api/webhooks/fathom/[userId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 401 when secret param is missing', async () => {
    const request = makeRequest('user-123', { call_id: 'abc', transcript: 'Hello world' });
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 401 when secret does not match stored webhook_secret', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'correct-secret', is_active: true },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const request = makeRequest('user-123', { call_id: 'abc', transcript: 'Hello world' }, 'wrong-secret');
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error).toBe('Unauthorized');
  });

  it('should return 401 when no integration found', async () => {
    const mockClient = createMockSupabase({
      integration: null,
      integrationError: { message: 'No rows returned' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const request = makeRequest('user-123', { call_id: 'abc', transcript: 'Hello world' }, 'some-secret');
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(401);
  });

  it('should return 400 when payload is missing transcript', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const request = makeRequest('user-123', { call_id: 'abc' }, 'test-secret');
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('should return 400 when payload is missing meeting ID', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const request = makeRequest('user-123', { transcript: 'A long enough transcript that passes the minimum length check for processing' }, 'test-secret');
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toMatch(/missing/i);
  });

  it('should process valid Fathom payload and return transcript_id', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
      existingTranscript: null,
      insertedTranscript: { id: 'transcript-abc-123' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const transcriptText = 'A'.repeat(150); // > 100 chars
    const request = makeRequest(
      'user-123',
      {
        call_id: 'fathom-call-001',
        title: 'Weekly Standup',
        transcript: transcriptText,
        duration: 1800, // 30 minutes in seconds
        participants: ['Alice', 'Bob'],
        date: '2026-02-23T10:00:00Z',
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.transcript_id).toBe('transcript-abc-123');

    // Verify Supabase was called 3 times
    expect(mockClient.from).toHaveBeenCalledTimes(3);
    expect(mockClient.from).toHaveBeenNthCalledWith(1, 'user_integrations');
    expect(mockClient.from).toHaveBeenNthCalledWith(2, 'cp_call_transcripts');
    expect(mockClient.from).toHaveBeenNthCalledWith(3, 'cp_call_transcripts');
  });

  it('should handle duplicate transcript and return duplicate: true', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
      existingTranscript: { id: 'existing-transcript-id' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const transcriptText = 'B'.repeat(150);
    const request = makeRequest(
      'user-123',
      {
        call_id: 'fathom-call-001',
        transcript: transcriptText,
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.duplicate).toBe(true);
    expect(body.transcript_id).toBe('existing-transcript-id');

    // Should NOT have called insert (only 2 from() calls: integration + dedup)
    expect(mockClient.from).toHaveBeenCalledTimes(2);
  });

  it('should trigger process-transcript after successful insert', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
      existingTranscript: null,
      insertedTranscript: { id: 'new-transcript-id' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const transcriptText = 'C'.repeat(150);
    const request = makeRequest(
      'user-123',
      {
        call_id: 'fathom-call-002',
        transcript: transcriptText,
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    await POST(request, { params });

    expect(mockTrigger).toHaveBeenCalledWith('process-transcript', {
      userId: 'user-123',
      transcriptId: 'new-transcript-id',
    });
  });

  it('should skip short transcripts (< 100 chars)', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const request = makeRequest(
      'user-123',
      {
        call_id: 'fathom-call-short',
        transcript: 'Too short',
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.skipped).toBe(true);

    // Should only have called from() once (integration check), not dedup or insert
    expect(mockClient.from).toHaveBeenCalledTimes(1);
  });

  it('should accept transcript_text as alternative field name', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
      existingTranscript: null,
      insertedTranscript: { id: 'transcript-alt-field' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const transcriptText = 'D'.repeat(150);
    const request = makeRequest(
      'user-123',
      {
        id: 'fathom-alt-id',
        transcript_text: transcriptText,
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.transcript_id).toBe('transcript-alt-field');
  });

  it('should accept meeting_id as alternative field name', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
      existingTranscript: null,
      insertedTranscript: { id: 'transcript-meeting-id' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const transcriptText = 'E'.repeat(150);
    const request = makeRequest(
      'user-123',
      {
        meeting_id: 'fathom-meeting-xyz',
        transcript: transcriptText,
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.success).toBe(true);
    expect(body.transcript_id).toBe('transcript-meeting-id');
  });

  it('should normalize duration from seconds to minutes', async () => {
    const mockClient = createMockSupabase({
      integration: { webhook_secret: 'test-secret', is_active: true },
      existingTranscript: null,
      insertedTranscript: { id: 'transcript-duration' },
    });
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mockClient);

    const transcriptText = 'F'.repeat(150);
    const request = makeRequest(
      'user-123',
      {
        call_id: 'fathom-duration-test',
        transcript: transcriptText,
        duration: 3600, // 60 minutes in seconds
      },
      'test-secret'
    );
    const params = Promise.resolve({ userId: 'user-123' });

    await POST(request, { params });

    // Verify the insert call was made with duration in minutes
    // The 3rd from() call is the insert
    const insertCall = mockClient.from.mock.results[2];
    const insertChain = insertCall.value;
    const insertArgs = insertChain.insert.mock.calls[0][0];
    expect(insertArgs.duration_minutes).toBe(60);
  });
});
