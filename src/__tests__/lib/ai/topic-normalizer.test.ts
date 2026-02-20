/**
 * @jest-environment node
 */

// Mock modules — must come before imports
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/anthropic-client', () => ({
  getAnthropicClient: jest.fn(),
  parseJsonResponse: jest.fn((text: string) => JSON.parse(text)),
}));

jest.mock('@/lib/ai/content-pipeline/model-config', () => ({
  CLAUDE_HAIKU_MODEL: 'claude-haiku-test',
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
}));

import { normalizeTopics, upsertTopics } from '@/lib/ai/content-pipeline/topic-normalizer';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getAnthropicClient } from '@/lib/ai/content-pipeline/anthropic-client';

const mockCreateSupabase = createSupabaseAdminClient as jest.Mock;
const mockGetAnthropic = getAnthropicClient as jest.Mock;

function createMockSupabase() {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => Promise.resolve({ data: [] }));
  chain.upsert = jest.fn(() => Promise.resolve({ data: null, error: null }));

  const client = {
    from: jest.fn(() => chain),
    _chain: chain,
  };
  return client;
}

describe('normalizeTopics', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;
  let mockMessagesCreate: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockSupabase = createMockSupabase();
    mockCreateSupabase.mockReturnValue(mockSupabase);

    // Default: 2 existing topics
    mockSupabase._chain.limit.mockResolvedValue({
      data: [
        { slug: 'cold-email', display_name: 'Cold Email', description: 'Cold email tactics' },
        { slug: 'linkedin', display_name: 'LinkedIn', description: 'LinkedIn growth' },
      ],
    });

    mockMessagesCreate = jest.fn();
    mockGetAnthropic.mockReturnValue({
      messages: { create: mockMessagesCreate },
    });
  });

  it('returns empty array for empty suggestions', async () => {
    const result = await normalizeTopics('user-1', [], 'some content');
    expect(result).toEqual([]);
    expect(mockMessagesCreate).not.toHaveBeenCalled();
  });

  it('maps suggestions to existing topics via AI', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { slug: 'cold-email', display_name: 'Cold Email', description: 'Cold email tactics', is_new: false },
        ]),
      }],
    });

    const result = await normalizeTopics('user-1', ['Cold Emailing'], 'How to write cold emails');

    expect(result).toEqual([
      { slug: 'cold-email', display_name: 'Cold Email', description: 'Cold email tactics', is_new: false },
    ]);
    expect(mockMessagesCreate).toHaveBeenCalledTimes(1);
  });

  it('creates new topics when AI suggests them', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { slug: 'seo-strategy', display_name: 'SEO Strategy', description: 'Search engine optimization', is_new: true },
        ]),
      }],
    });

    const result = await normalizeTopics('user-1', ['SEO'], 'Search engine optimization tips');

    expect(result).toHaveLength(1);
    expect(result[0].slug).toBe('seo-strategy');
    expect(result[0].is_new).toBe(true);
  });

  it('limits to 3 topics max', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { slug: 'a', display_name: 'A', description: '', is_new: true },
          { slug: 'b', display_name: 'B', description: '', is_new: true },
          { slug: 'c', display_name: 'C', description: '', is_new: true },
          { slug: 'd', display_name: 'D', description: '', is_new: true },
        ]),
      }],
    });

    const result = await normalizeTopics('user-1', ['A', 'B', 'C', 'D'], 'content');

    expect(result).toHaveLength(3);
  });

  it('falls back to deterministic slugs when AI returns unparseable response', async () => {
    // The try/catch in normalizeTopics wraps parseJsonResponse, not the API call.
    // Return valid API response but with non-JSON text to trigger parse fallback.
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'not valid json at all' }],
    });

    const result = await normalizeTopics('user-1', ['Cold Email', 'LinkedIn DMs'], 'content');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      slug: 'cold-email',
      display_name: 'Cold Email',
      description: '',
      is_new: true,
    });
    expect(result[1]).toEqual({
      slug: 'linkedin-dms',
      display_name: 'LinkedIn DMs',
      description: '',
      is_new: true,
    });
  });

  it('fallback handles special characters in topic names', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '--- invalid ---' }],
    });

    const result = await normalizeTopics('user-1', ['B2B SaaS (Enterprise)'], 'content');

    expect(result[0].slug).toBe('b2b-saas-enterprise');
    expect(result[0].slug).not.toMatch(/[^a-z0-9-]/);
  });

  it('fallback limits to 3 topics', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'broken' }],
    });

    const result = await normalizeTopics('user-1', ['A', 'B', 'C', 'D'], 'content');
    expect(result).toHaveLength(3);
  });

  it('passes existing vocabulary to the AI prompt', async () => {
    mockMessagesCreate.mockResolvedValue({
      content: [{ type: 'text', text: '[]' }],
    });

    await normalizeTopics('user-1', ['Sales'], 'content about sales');

    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('cold-email');
    expect(prompt).toContain('Cold Email');
    expect(prompt).toContain('linkedin');
  });

  it('handles empty existing vocabulary', async () => {
    mockSupabase._chain.limit.mockResolvedValue({ data: [] });

    mockMessagesCreate.mockResolvedValue({
      content: [{
        type: 'text',
        text: JSON.stringify([
          { slug: 'new-topic', display_name: 'New Topic', description: 'desc', is_new: true },
        ]),
      }],
    });

    const result = await normalizeTopics('user-1', ['New Topic'], 'content');

    expect(result).toHaveLength(1);
    const prompt = mockMessagesCreate.mock.calls[0][0].messages[0].content;
    expect(prompt).toContain('(empty — all topics will be new)');
  });
});

describe('upsertTopics', () => {
  let mockSupabase: ReturnType<typeof createMockSupabase>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    mockCreateSupabase.mockReturnValue(mockSupabase);
  });

  it('upserts new topics to Supabase', async () => {
    const topics = [
      { slug: 'seo', display_name: 'SEO', description: 'Search optimization', is_new: true },
    ];

    const slugs = await upsertTopics('user-1', topics);

    expect(slugs).toEqual(['seo']);
    expect(mockSupabase.from).toHaveBeenCalledWith('cp_knowledge_topics');
    expect(mockSupabase._chain.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        slug: 'seo',
        display_name: 'SEO',
        description: 'Search optimization',
        entry_count: 0,
      },
      { onConflict: 'user_id,slug' }
    );
  });

  it('skips upsert for existing topics (is_new=false)', async () => {
    const topics = [
      { slug: 'cold-email', display_name: 'Cold Email', description: 'existing', is_new: false },
    ];

    const slugs = await upsertTopics('user-1', topics);

    expect(slugs).toEqual(['cold-email']);
    expect(mockSupabase._chain.upsert).not.toHaveBeenCalled();
  });

  it('returns slugs for all topics regardless of is_new', async () => {
    const topics = [
      { slug: 'existing', display_name: 'Existing', description: '', is_new: false },
      { slug: 'new-one', display_name: 'New One', description: '', is_new: true },
    ];

    const slugs = await upsertTopics('user-1', topics);

    expect(slugs).toEqual(['existing', 'new-one']);
    expect(mockSupabase._chain.upsert).toHaveBeenCalledTimes(1);
  });

  it('handles empty description by setting null', async () => {
    const topics = [
      { slug: 'test', display_name: 'Test', description: '', is_new: true },
    ];

    await upsertTopics('user-1', topics);

    expect(mockSupabase._chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ description: null }),
      expect.any(Object)
    );
  });

  it('returns empty array for empty topics', async () => {
    const slugs = await upsertTopics('user-1', []);
    expect(slugs).toEqual([]);
    expect(mockSupabase._chain.upsert).not.toHaveBeenCalled();
  });
});
