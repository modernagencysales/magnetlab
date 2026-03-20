/**
 * @jest-environment node
 *
 * Tests for POST /api/content-pipeline/posts/generate
 */

import { POST } from '@/app/api/content-pipeline/posts/generate/route';
import { NextRequest } from 'next/server';

// ─── Module mocks ─────────────────────────────────────────────────────────────

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
  getDataScope: jest.fn().mockResolvedValue({ type: 'user', userId: 'user-1', teamId: null }),
}));

// Mock the AI assembler — don't call Anthropic in tests
jest.mock('@/lib/ai/content-pipeline/primitives-assembler', () => ({
  generateFromPrimitives: jest.fn(),
}));

import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateFromPrimitives } from '@/lib/ai/content-pipeline/primitives-assembler';

// ─── Mock Supabase chain builder ──────────────────────────────────────────────

type TableResult = { data: unknown; error: unknown };

function createMockSupabase() {
  const tableResults: Record<string, TableResult> = {};
  // Track the sequence of calls to from() to support multiple calls to the same table
  const callSequence: string[] = [];
  const sequenceResults: Map<string, TableResult[]> = new Map();

  function createChain(tableName: string) {
    const chain: Record<string, jest.Mock> = {};
    const callIndex = callSequence.filter((t) => t === tableName).length;
    callSequence.push(tableName);

    const getResult = (): TableResult => {
      const seq = sequenceResults.get(tableName);
      if (seq && seq[callIndex] !== undefined) {
        return seq[callIndex];
      }
      return tableResults[tableName] ?? { data: null, error: null };
    };

    chain.select = jest.fn(() => chain);
    chain.eq = jest.fn(() => chain);
    chain.or = jest.fn(() => chain);
    chain.in = jest.fn(() => chain);
    chain.update = jest.fn(() => chain);
    chain.insert = jest.fn(() => chain);
    chain.single = jest.fn(() => Promise.resolve(getResult()));

    // Thenable for insert().select().single() chain — handled by single()
    Object.defineProperty(chain, 'then', {
      value: (
        onFulfilled?: (value: unknown) => unknown,
        onRejected?: (reason: unknown) => unknown
      ) => {
        const result = getResult();
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
    setTableSequence: (table: string, results: TableResult[]) => {
      sequenceResults.set(table, results);
    },
    reset: () => {
      Object.keys(tableResults).forEach((k) => delete tableResults[k]);
      sequenceResults.clear();
      callSequence.length = 0;
    },
  };
}

// ─── Mock data ────────────────────────────────────────────────────────────────

const MOCK_EXPLOIT = {
  name: 'Tweet Commentary',
  prompt_template: 'Write a commentary on this tweet: {{creative_text}}',
  example_posts: ['Example post 1', 'Example post 2'],
};

const EXPLOIT_UUID = '11111111-1111-1111-1111-111111111111';
const CREATIVE_UUID = '22222222-2222-2222-2222-222222222222';
const POST_UUID = '33333333-3333-3333-3333-333333333333';

const MOCK_CREATIVE = {
  id: CREATIVE_UUID,
  user_id: 'user-1',
  content_text: 'Cold email is dead. Here is why...',
  image_url: null,
  times_used: 0,
};

const MOCK_GENERATED_POST = {
  content: 'Cold email is not dead. Here is the take everyone missed...',
  hook_used: 'Cold email is not dead.',
};

const MOCK_SAVED_POST = {
  id: POST_UUID,
  user_id: 'user-1',
  draft_content: MOCK_GENERATED_POST.content,
  status: 'draft',
  exploit_id: EXPLOIT_UUID,
  creative_id: CREATIVE_UUID,
  idea_id: null,
  created_at: '2026-03-19T00:00:00Z',
  updated_at: '2026-03-19T00:00:00Z',
};

// ─── Test suite ───────────────────────────────────────────────────────────────

let mock: ReturnType<typeof createMockSupabase>;

describe('POST /api/content-pipeline/posts/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mock = createMockSupabase();
    (createSupabaseAdminClient as jest.Mock).mockReturnValue(mock.client);
  });

  // ─── Auth ────────────────────────────────────────────────────────────────

  describe('auth', () => {
    it('returns 401 when not authenticated', async () => {
      (auth as jest.Mock).mockResolvedValue(null);

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ exploit_id: EXPLOIT_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });
  });

  // ─── Validation ───────────────────────────────────────────────────────────

  describe('input validation', () => {
    it('returns 400 with invalid input (bad UUID)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ exploit_id: 'not-a-uuid' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toBeDefined();
    });

    it('returns 400 when knowledge_ids contains invalid UUID', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ knowledge_ids: ['not-valid-uuid'] }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(400);
    });
  });

  // ─── Happy path ───────────────────────────────────────────────────────────

  describe('happy path — exploit + creative', () => {
    it('generates post from exploit + creative', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      mock.setTableResult('cp_exploits', { data: MOCK_EXPLOIT, error: null });
      mock.setTableResult('cp_creatives', { data: MOCK_CREATIVE, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({
          exploit_id: EXPLOIT_UUID,
          creative_id: CREATIVE_UUID,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.post).toBeDefined();
      expect(data.generated).toBeDefined();
      expect(data.generated.content).toBe(MOCK_GENERATED_POST.content);
    });

    it('saves draft post with exploit_id and creative_id', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      mock.setTableResult('cp_exploits', { data: MOCK_EXPLOIT, error: null });
      mock.setTableResult('cp_creatives', { data: MOCK_CREATIVE, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({
          exploit_id: EXPLOIT_UUID,
          creative_id: CREATIVE_UUID,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data.post.exploit_id).toBe(EXPLOIT_UUID);
      expect(data.post.creative_id).toBe(CREATIVE_UUID);
      expect(data.post.status).toBe('draft');

      // Verify insert was called on cp_pipeline_posts
      expect(mock.client.from).toHaveBeenCalledWith('cp_pipeline_posts');
    });

    it('works with only hook and instructions (no primitives)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      mock.setTableResult('cp_pipeline_posts', {
        data: { ...MOCK_SAVED_POST, exploit_id: null, creative_id: null },
        error: null,
      });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({
          hook: 'Everyone is wrong about cold email',
          instructions: 'Make it punchy and bold',
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);
      expect(generateFromPrimitives).toHaveBeenCalledWith(
        expect.objectContaining({
          hook: 'Everyone is wrong about cold email',
          instructions: 'Make it punchy and bold',
        })
      );
    });
  });

  // ─── Error cases ──────────────────────────────────────────────────────────

  describe('error handling', () => {
    it('returns 500 when generation fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(null);

      mock.setTableResult('cp_exploits', { data: MOCK_EXPLOIT, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ exploit_id: EXPLOIT_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Post generation failed');
    });

    it('returns 500 when post insert fails', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      mock.setTableResult('cp_exploits', { data: MOCK_EXPLOIT, error: null });
      mock.setTableResult('cp_pipeline_posts', {
        data: null,
        error: { message: 'Insert failed', code: '500' },
      });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ exploit_id: EXPLOIT_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Failed to save post');
    });

    it('still returns 201 when creative usage update throws (fire-and-forget)', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      // Exploit and initial creative fetch succeed; post insert succeeds
      mock.setTableResult('cp_exploits', { data: MOCK_EXPLOIT, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      // Creative fetch succeeds initially (for building primitives), but
      // the times_used read during fire-and-forget throws.
      let creativeCallCount = 0;
      (mock.client.from as jest.Mock).mockImplementation((table: string) => {
        if (table === 'cp_creatives') {
          creativeCallCount++;
          if (creativeCallCount === 1) {
            // First call: primitives fetch — return valid creative
            const chain: Record<string, jest.Mock> = {};
            chain.select = jest.fn(() => chain);
            chain.eq = jest.fn(() => chain);
            chain.or = jest.fn(() => chain);
            chain.in = jest.fn(() => chain);
            chain.update = jest.fn(() => chain);
            chain.insert = jest.fn(() => chain);
            chain.single = jest.fn(() => Promise.resolve({ data: MOCK_CREATIVE, error: null }));
            return chain;
          }
          // Subsequent calls (fire-and-forget times_used read): throw
          throw new Error('Creative update failed');
        }
        // All other tables: use normal mock chain
        const chain: Record<string, jest.Mock> = {};
        chain.select = jest.fn(() => chain);
        chain.eq = jest.fn(() => chain);
        chain.or = jest.fn(() => chain);
        chain.in = jest.fn(() => chain);
        chain.update = jest.fn(() => chain);
        chain.insert = jest.fn(() => chain);
        const result =
          table === 'cp_pipeline_posts'
            ? { data: MOCK_SAVED_POST, error: null }
            : table === 'cp_exploits'
              ? { data: MOCK_EXPLOIT, error: null }
              : { data: null, error: null };
        chain.single = jest.fn(() => Promise.resolve(result));
        return chain;
      });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({
          exploit_id: EXPLOIT_UUID,
          creative_id: CREATIVE_UUID,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      // Should succeed despite creative update failure
      expect(response.status).toBe(201);
    });
  });

  // ─── Cross-tenant scoping ──────────────────────────────────────────────────

  describe('cross-tenant data scoping', () => {
    const KNOWLEDGE_UUID_1 = '44444444-4444-4444-4444-444444444444';
    const KNOWLEDGE_UUID_2 = '55555555-5555-5555-5555-555555555555';
    const TEMPLATE_UUID = '66666666-6666-6666-6666-666666666666';
    const IDEA_UUID = '77777777-7777-7777-7777-777777777777';
    const STYLE_UUID = '88888888-8888-8888-8888-888888888888';

    it('scopes knowledge_ids query to user_id — other users knowledge excluded', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      // Knowledge query returns empty (user_id filter excluded the other user's entries)
      mock.setTableResult('cp_knowledge_entries', { data: [], error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ knowledge_ids: [KNOWLEDGE_UUID_1, KNOWLEDGE_UUID_2] }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify knowledge query was scoped to user_id
      const knowledgeCall = (mock.client.from as jest.Mock).mock.results.find(
        (_r: { type: string; value: unknown }, i: number) =>
          (mock.client.from as jest.Mock).mock.calls[i][0] === 'cp_knowledge_entries'
      );
      expect(knowledgeCall).toBeDefined();
      const chain = knowledgeCall!.value;
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');
      expect(chain.in).toHaveBeenCalledWith('id', [KNOWLEDGE_UUID_1, KNOWLEDGE_UUID_2]);

      // Knowledge was empty so primitives should NOT include knowledge
      expect(generateFromPrimitives).toHaveBeenCalledWith(
        expect.not.objectContaining({ knowledge: expect.anything() })
      );
    });

    it('scopes template_id query with or filter for global/user/team access', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      // Template query returns null (user doesn't own it, not global, not their team)
      mock.setTableResult('cp_post_templates', { data: null, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ template_id: TEMPLATE_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify template query includes or() scoping
      const templateCall = (mock.client.from as jest.Mock).mock.results.find(
        (_r: { type: string; value: unknown }, i: number) =>
          (mock.client.from as jest.Mock).mock.calls[i][0] === 'cp_post_templates'
      );
      expect(templateCall).toBeDefined();
      const chain = templateCall!.value;
      expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('is_global.eq.true'));
      expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('user_id.eq.user-1'));
    });

    it('scopes idea_id query to user_id', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      // Idea query returns null (wrong user)
      mock.setTableResult('cp_content_ideas', { data: null, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ idea_id: IDEA_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify idea query was scoped to user_id
      const ideaCall = (mock.client.from as jest.Mock).mock.results.find(
        (_r: { type: string; value: unknown }, i: number) =>
          (mock.client.from as jest.Mock).mock.calls[i][0] === 'cp_content_ideas'
      );
      expect(ideaCall).toBeDefined();
      const chain = ideaCall!.value;
      expect(chain.eq).toHaveBeenCalledWith('user_id', 'user-1');

      // Idea was null so primitives should NOT include idea
      expect(generateFromPrimitives).toHaveBeenCalledWith(
        expect.not.objectContaining({ idea: expect.anything() })
      );
    });

    it('scopes style_id query with or filter for user/team access', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      // Style query returns null (wrong user, wrong team)
      mock.setTableResult('cp_writing_styles', { data: null, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({ style_id: STYLE_UUID }),
        headers: { 'Content-Type': 'application/json' },
      });
      const response = await POST(request);

      expect(response.status).toBe(201);

      // Verify style query includes or() scoping
      const styleCall = (mock.client.from as jest.Mock).mock.results.find(
        (_r: { type: string; value: unknown }, i: number) =>
          (mock.client.from as jest.Mock).mock.calls[i][0] === 'cp_writing_styles'
      );
      expect(styleCall).toBeDefined();
      const chain = styleCall!.value;
      expect(chain.or).toHaveBeenCalledWith(expect.stringContaining('user_id.eq.user-1'));
    });
  });

  // ─── generateFromPrimitives call shape ───────────────────────────────────

  describe('primitives assembly', () => {
    it('passes exploit and creative as primitives to generateFromPrimitives', async () => {
      (auth as jest.Mock).mockResolvedValue({ user: { id: 'user-1' } });
      (generateFromPrimitives as jest.Mock).mockResolvedValue(MOCK_GENERATED_POST);

      mock.setTableResult('cp_exploits', { data: MOCK_EXPLOIT, error: null });
      mock.setTableResult('cp_creatives', { data: MOCK_CREATIVE, error: null });
      mock.setTableResult('cp_pipeline_posts', { data: MOCK_SAVED_POST, error: null });

      const request = new NextRequest('http://localhost:3000/api/content-pipeline/posts/generate', {
        method: 'POST',
        body: JSON.stringify({
          exploit_id: EXPLOIT_UUID,
          creative_id: CREATIVE_UUID,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      await POST(request);

      expect(generateFromPrimitives).toHaveBeenCalledWith(
        expect.objectContaining({
          exploit: expect.objectContaining({
            name: MOCK_EXPLOIT.name,
            prompt_template: MOCK_EXPLOIT.prompt_template,
          }),
          creative: expect.objectContaining({
            content_text: MOCK_CREATIVE.content_text,
          }),
        })
      );
    });
  });
});
