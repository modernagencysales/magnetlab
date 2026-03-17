/**
 * @jest-environment node
 *
 * Tests for POST /api/content-pipeline/posts
 * Agent-authored content: agent provides body directly, no AI generation.
 */

import { POST } from '@/app/api/content-pipeline/posts/route';
import { NextRequest } from 'next/server';

// ─── Mocks ─────────────────────────────────────────────────────────────────

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
  logDebug: jest.fn(),
}));

jest.mock('@/lib/utils/team-context', () => ({
  getDataScope: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock Supabase builder ──────────────────────────────────────────────────

/**
 * Builds a mock Supabase client that supports the chainable insert pattern:
 *   from → insert → select → single → Promise
 */
function createMockSupabase() {
  let insertResult: { data: unknown; error: unknown } = { data: null, error: null };

  const insertChain = {
    select: jest.fn(() => insertChain),
    single: jest.fn(() => Promise.resolve(insertResult)),
  };

  const client = {
    from: jest.fn(() => ({
      insert: jest.fn(() => insertChain),
    })),
  };

  return {
    client,
    setInsertResult: (result: { data: unknown; error: unknown }) => {
      insertResult = result;
    },
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function buildRequest(body: Record<string, unknown>) {
  return new NextRequest('http://localhost:3000/api/content-pipeline/posts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const MOCK_POST = {
  id: 'post-new-1',
  user_id: 'user-1',
  draft_content: 'Here is my agent-authored post body.',
  final_content: null,
  status: 'draft',
  source: 'agent',
  agent_metadata: {
    title: 'My First Post',
    pillar: 'teaching_promotion',
    content_type: 'insight',
  },
  idea_id: null,
  dm_template: null,
  cta_word: null,
  variations: null,
  hook_score: null,
  polish_status: null,
  polish_notes: null,
  is_buffer: false,
  buffer_position: null,
  scheduled_time: null,
  auto_publish_after: null,
  linkedin_post_id: null,
  publish_provider: null,
  lead_magnet_id: null,
  published_at: null,
  engagement_stats: null,
  team_profile_id: null,
  created_at: '2026-03-13T00:00:00Z',
  updated_at: '2026-03-13T00:00:00Z',
};

// ─── Import schema for direct validation tests ──────────────────────────────

import { CreateAgentPostSchema } from '@/lib/validations/api';

// ─── Tests ─────────────────────────────────────────────────────────────────

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/content-pipeline/posts — agent-authored', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
    (getDataScope as jest.Mock).mockImplementation(async (userId: string) => ({
      type: 'user',
      userId,
    }));
  });

  // ─── Auth ───────────────────────────────────────────────────────────────

  it('returns 401 when unauthenticated', async () => {
    (auth as jest.Mock).mockResolvedValue(null);

    const response = await POST(buildRequest({ body: 'some content' }));

    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.error).toBe('Unauthorized');
  });

  // ─── Validation ─────────────────────────────────────────────────────────

  it('returns 400 when body field is missing', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/body/i);
  });

  it('returns 400 when body is an empty string', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({ body: '' }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/body/i);
  });

  it('returns 400 when pillar value is invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({ body: 'content', pillar: 'not_a_real_pillar' }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/pillar/i);
  });

  it('returns 400 when content_type value is invalid', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

    const response = await POST(buildRequest({ body: 'content', content_type: 'not_a_real_type' }));

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toMatch(/content_type/i);
  });

  // ─── Success ────────────────────────────────────────────────────────────

  it('creates a draft post with body only', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setInsertResult({
      data: { ...MOCK_POST, agent_metadata: null, title: null },
      error: null,
    });

    const response = await POST(buildRequest({ body: 'Here is my agent-authored post body.' }));

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.post).toBeDefined();
    expect(data.post.status).toBe('draft');
    expect(data.post.source).toBe('agent');
    expect(mock.client.from).toHaveBeenCalledWith('cp_pipeline_posts');
  });

  it('creates a post with all optional fields', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setInsertResult({ data: MOCK_POST, error: null });

    const response = await POST(
      buildRequest({
        body: 'Here is my agent-authored post body.',
        title: 'My First Post',
        pillar: 'teaching_promotion',
        content_type: 'insight',
      })
    );

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.post).toBeDefined();
    expect(data.post.status).toBe('draft');
  });

  it('sets source to agent on the created post', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setInsertResult({ data: MOCK_POST, error: null });

    const response = await POST(buildRequest({ body: 'Content here.' }));

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.post.source).toBe('agent');
  });

  it('creates a post with only pillar (no content_type or title)', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setInsertResult({
      data: { ...MOCK_POST, agent_metadata: { pillar: 'human_personal' } },
      error: null,
    });

    const response = await POST(buildRequest({ body: 'Content here.', pillar: 'human_personal' }));

    expect(response.status).toBe(201);
    const data = await response.json();
    expect(data.post).toBeDefined();
  });

  // ─── Error handling ──────────────────────────────────────────────────────

  it('returns 500 when database insert fails', async () => {
    (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
    mock.setInsertResult({ data: null, error: { message: 'DB write failed', code: '500' } });

    const response = await POST(buildRequest({ body: 'Content here.' }));

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});

// ─── Zod schema tests ────────────────────────────────────────────────────────

describe('CreateAgentPostSchema validation', () => {
  it('accepts minimal valid input', () => {
    const result = CreateAgentPostSchema.safeParse({ body: 'My post content.' });
    expect(result.success).toBe(true);
  });

  it('accepts full valid input', () => {
    const result = CreateAgentPostSchema.safeParse({
      body: 'Post content here.',
      title: 'A great post',
      pillar: 'moments_that_matter',
      content_type: 'story',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing body', () => {
    const result = CreateAgentPostSchema.safeParse({ title: 'No body' });
    expect(result.success).toBe(false);
  });

  it('rejects empty body', () => {
    const result = CreateAgentPostSchema.safeParse({ body: '' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid pillar', () => {
    const result = CreateAgentPostSchema.safeParse({ body: 'content', pillar: 'wrong' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid content_type', () => {
    const result = CreateAgentPostSchema.safeParse({ body: 'content', content_type: 'wrong' });
    expect(result.success).toBe(false);
  });

  it('accepts all valid pillar values', () => {
    const pillars = [
      'moments_that_matter',
      'teaching_promotion',
      'human_personal',
      'collaboration_social_proof',
    ];
    for (const pillar of pillars) {
      const result = CreateAgentPostSchema.safeParse({ body: 'content', pillar });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid content_type values', () => {
    const types = [
      'story',
      'insight',
      'tip',
      'framework',
      'case_study',
      'question',
      'listicle',
      'contrarian',
      'lead_magnet',
    ];
    for (const content_type of types) {
      const result = CreateAgentPostSchema.safeParse({ body: 'content', content_type });
      expect(result.success).toBe(true);
    }
  });
});
