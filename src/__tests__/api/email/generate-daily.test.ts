/**
 * @jest-environment node
 */

import { POST } from '@/app/api/email/generate-daily/route';
import { NextRequest } from 'next/server';

// Mock auth
jest.mock('@/lib/auth', () => ({
  auth: jest.fn(),
}));

// Mock Supabase
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

// Mock team-context
jest.mock('@/lib/utils/team-context', () => ({
  requireTeamScope: jest.fn(),
}));

// Mock email-writer
jest.mock('@/lib/ai/content-pipeline/email-writer', () => ({
  writeNewsletterEmail: jest.fn(),
}));

// Mock briefing-agent
jest.mock('@/lib/ai/content-pipeline/briefing-agent', () => ({
  buildContentBrief: jest.fn(),
}));

// Mock logger
jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
  logDebug: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { requireTeamScope } from '@/lib/utils/team-context';
import { writeNewsletterEmail } from '@/lib/ai/content-pipeline/email-writer';
import { buildContentBrief } from '@/lib/ai/content-pipeline/briefing-agent';

// ============================================================
// Mock Supabase client with chainable query support
// ============================================================

type TableResult = { data: unknown; error: unknown };

function createMockSupabase() {
  const tableResults: Record<string, TableResult> = {};

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};

    chain.select = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.gte = jest.fn(() => chain);
    chain.limit = jest.fn(() => chain);
    chain.single = jest.fn(() => {
      const result = tableResults[tableName] || { data: null, error: null };
      return Promise.resolve(result);
    });

    // Make the chain thenable so `await query` resolves
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
    reset: () => {
      Object.keys(tableResults).forEach(k => delete tableResults[k]);
    },
  };
}

let mock: ReturnType<typeof createMockSupabase>;

// ============================================================
// Helpers
// ============================================================

function makeRequest(body?: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/email/generate-daily', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const mockBroadcast = {
  id: 'broadcast-1',
  team_id: 'team-abc',
  user_id: 'user-1',
  subject: 'Why Outbound Still Works',
  body: '## The Shift\n\nOutbound is evolving...',
  status: 'draft',
  recipient_count: 0,
  created_at: '2026-02-23T10:00:00Z',
  updated_at: '2026-02-23T10:00:00Z',
};

// ============================================================
// Tests
// ============================================================

describe('POST /api/email/generate-daily', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);

    // Default: authenticated user with team
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    (requireTeamScope as jest.Mock).mockResolvedValue({
      type: 'team',
      userId: 'user-1',
      teamId: 'team-abc',
    });

    // Default profile result
    mock.setTableResult('team_profiles', {
      data: [
        {
          id: 'profile-1',
          voice_profile: { tone: 'conversational' },
          full_name: 'Tim Johnson',
        },
      ],
      error: null,
    });

    // Default: no today's posts
    mock.setTableResult('cp_pipeline_posts', { data: [], error: null });

    // Default: briefing agent returns compiled context
    (buildContentBrief as jest.Mock).mockResolvedValue({
      topic: 'B2B growth',
      compiledContext: 'KEY INSIGHTS:\n- Outbound works when personalized\n',
      suggestedAngles: [],
      topicReadiness: 0.5,
      topKnowledgeTypes: ['insight'],
      relevantInsights: [],
      relevantQuestions: [],
      relevantProductIntel: [],
    });

    // Default: email writer returns result
    (writeNewsletterEmail as jest.Mock).mockResolvedValue({
      subject: 'Why Outbound Still Works',
      body: '## The Shift\n\nOutbound is evolving...',
    });

    // Default: insert returns broadcast
    mock.setTableResult('email_broadcasts', {
      data: mockBroadcast,
      error: null,
    });
  });

  // ----------------------------------------
  // 1. Auth required -> 401
  // ----------------------------------------

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when session has no user id', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: {} });

    const response = await POST(makeRequest());

    expect(response.status).toBe(401);
  });

  // ----------------------------------------
  // 2. Returns 400 when no team found
  // ----------------------------------------

  it('returns 400 when user has no team', async () => {
    (requireTeamScope as jest.Mock).mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toContain('No team found');
  });

  // ----------------------------------------
  // 3. Generates draft with subject/body -> 201
  // ----------------------------------------

  it('generates draft with subject and body and returns 201', async () => {
    const response = await POST(makeRequest());

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.broadcast).toBeDefined();
    expect(data.broadcast.subject).toBe('Why Outbound Still Works');
    expect(data.broadcast.body).toContain('Outbound is evolving');
    expect(data.broadcast.status).toBe('draft');
  });

  // ----------------------------------------
  // 4. Stores draft in email_broadcasts with status='draft'
  // ----------------------------------------

  it('inserts broadcast into email_broadcasts table with correct fields', async () => {
    await POST(makeRequest());

    // Verify supabase.from('email_broadcasts').insert() was called
    expect(mock.client.from).toHaveBeenCalledWith('email_broadcasts');

    // Find the insert call on the email_broadcasts chain
    const fromCalls = mock.client.from.mock.calls;
    const broadcastCallIndex = fromCalls.findIndex(
      (call: string[]) => call[0] === 'email_broadcasts'
    );
    expect(broadcastCallIndex).toBeGreaterThanOrEqual(0);

    const chain = mock.client.from.mock.results[broadcastCallIndex].value;
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        team_id: 'team-abc',
        user_id: 'user-1',
        subject: 'Why Outbound Still Works',
        body: '## The Shift\n\nOutbound is evolving...',
        status: 'draft',
        recipient_count: 0,
      })
    );
  });

  // ----------------------------------------
  // 5. Uses provided topic if given
  // ----------------------------------------

  it('uses provided topic when given in request body', async () => {
    const response = await POST(makeRequest({ topic: 'Custom email topic' }));

    expect(response.status).toBe(201);

    // buildContentBrief should be called with the custom topic
    expect(buildContentBrief).toHaveBeenCalledWith(
      'user-1',
      'Custom email topic',
      expect.any(Object)
    );

    // writeNewsletterEmail should receive the custom topic
    expect(writeNewsletterEmail).toHaveBeenCalledWith(
      expect.objectContaining({ topic: 'Custom email topic' })
    );
  });

  // ----------------------------------------
  // 6. Falls back to LinkedIn post topic if no topic provided
  // ----------------------------------------

  it('falls back to LinkedIn post topic when no topic provided', async () => {
    mock.setTableResult('cp_pipeline_posts', {
      data: [{ draft_content: 'Stop doing cold calls\nHere is why warm intros win...' }],
      error: null,
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);

    // Should use the first line of the post as topic
    expect(buildContentBrief).toHaveBeenCalledWith(
      'user-1',
      'Stop doing cold calls',
      expect.any(Object)
    );

    // The LinkedIn topic should be passed for thematic consistency
    expect(writeNewsletterEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        topic: 'Stop doing cold calls',
        todaysLinkedInTopic: 'Stop doing cold calls',
      })
    );
  });

  // ----------------------------------------
  // 7. Falls back to generic topic when nothing available
  // ----------------------------------------

  it('falls back to generic topic when no topic and no LinkedIn post', async () => {
    mock.setTableResult('cp_pipeline_posts', { data: [], error: null });

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);

    expect(buildContentBrief).toHaveBeenCalledWith(
      'user-1',
      'B2B growth strategies and practical business advice',
      expect.any(Object)
    );
  });

  // ----------------------------------------
  // 8. Passes voice profile to email writer
  // ----------------------------------------

  it('passes voice profile and author name to writeNewsletterEmail', async () => {
    await POST(makeRequest());

    expect(writeNewsletterEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceProfile: { tone: 'conversational' },
        authorName: 'Tim Johnson',
      })
    );
  });

  // ----------------------------------------
  // 9. Handles profileId override
  // ----------------------------------------

  it('filters profiles by profileId when provided', async () => {
    await POST(makeRequest({ profileId: 'profile-custom' }));

    // Verify that eq was called on the team_profiles chain with the profileId
    const fromCalls = mock.client.from.mock.calls;
    const profileCallIndex = fromCalls.findIndex(
      (call: string[]) => call[0] === 'team_profiles'
    );
    expect(profileCallIndex).toBeGreaterThanOrEqual(0);

    const chain = mock.client.from.mock.results[profileCallIndex].value;
    expect(chain.eq).toHaveBeenCalledWith('id', 'profile-custom');
  });

  // ----------------------------------------
  // 10. Database error on insert
  // ----------------------------------------

  it('returns 500 when email_broadcasts insert fails', async () => {
    mock.setTableResult('email_broadcasts', {
      data: null,
      error: { message: 'Insert failed', code: '500' },
    });

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to save email draft');
  });

  // ----------------------------------------
  // 11. AI generation error
  // ----------------------------------------

  it('returns 500 when AI email generation fails', async () => {
    (writeNewsletterEmail as jest.Mock).mockRejectedValue(
      new Error('AI API rate limited')
    );

    const response = await POST(makeRequest());

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain('Failed to generate daily email');
  });

  // ----------------------------------------
  // 12. Empty request body handled gracefully
  // ----------------------------------------

  it('handles empty request body gracefully', async () => {
    const request = new NextRequest('http://localhost:3000/api/email/generate-daily', {
      method: 'POST',
    });

    const response = await POST(request);

    expect(response.status).toBe(201);
  });

  // ----------------------------------------
  // 13. Handles null profile gracefully
  // ----------------------------------------

  it('handles no profile found gracefully', async () => {
    mock.setTableResult('team_profiles', { data: [], error: null });

    const response = await POST(makeRequest());

    expect(response.status).toBe(201);

    // Should still call writeNewsletterEmail with null voice profile
    expect(writeNewsletterEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        voiceProfile: null,
        authorName: undefined,
      })
    );
  });
});
