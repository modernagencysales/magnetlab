/**
 * @jest-environment node
 */
import { buildCopilotSystemPrompt, clearSystemPromptCache } from '@/lib/ai/copilot/system-prompt';

jest.mock('@/lib/services/prompt-registry', () => ({
  getPrompt: jest.fn().mockResolvedValue({
    system_prompt: 'You are an AI co-pilot.',
    user_prompt: '',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    max_tokens: 4096,
  }),
  interpolatePrompt: jest.fn((t: string) => t),
}));

jest.mock('@/lib/ai/content-pipeline/voice-prompt-builder', () => ({
  buildVoicePromptSection: jest.fn().mockReturnValue('Voice: Direct, concise'),
}));

const mockFrom = jest.fn();
jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => ({ from: mockFrom })),
}));

function createChain(data: unknown = null, { useSingle: _useSingle = true }: { useSingle?: boolean } = {}) {
  const result = { data, error: null };
  const chain: Record<string, jest.Mock> = {};

  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.not = jest.fn().mockReturnValue(chain);
  chain.gte = jest.fn().mockReturnValue(chain);
  chain.in = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockReturnValue(chain);
  chain.limit = jest.fn().mockReturnValue(chain);
  chain.single = jest.fn().mockResolvedValue(result);

  // Make the chain thenable for queries that don't end with .single()
  // This allows `const { data } = await supabase.from(...).select(...).eq(...)...`
  chain.then = jest.fn((resolve: (value: typeof result) => void) => {
    return Promise.resolve(resolve(result));
  });

  return chain;
}

describe('buildCopilotSystemPrompt', () => {
  beforeEach(() => {
    clearSystemPromptCache();
    jest.clearAllMocks();

    mockFrom.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return createChain({ voice_profile: { tone: 'direct' }, full_name: 'Tim', title: 'CEO' });
      }
      if (table === 'copilot_memories') {
        return createChain([
          { rule: 'Never use bullet points', category: 'structure' },
        ]);
      }
      if (table === 'cp_pipeline_posts') {
        return createChain([]);
      }
      if (table === 'copilot_conversations') {
        return createChain([]);
      }
      if (table === 'copilot_messages') {
        return createChain([]);
      }
      return createChain();
    });
  });

  it('assembles base prompt + voice + user info', async () => {
    const result = await buildCopilotSystemPrompt('user-1');
    expect(result).toContain('You are an AI co-pilot');
    expect(result).toContain('Voice: Direct, concise');
    expect(result).toContain('Tim');
  });

  it('includes page context when provided', async () => {
    const result = await buildCopilotSystemPrompt('user-1', {
      page: '/content-pipeline',
      entityType: 'post',
      entityId: 'post-123',
      entityTitle: 'My Post',
    });
    expect(result).toContain('/content-pipeline');
    expect(result).toContain('My Post');
  });

  it('caches results for same user + page', async () => {
    await buildCopilotSystemPrompt('user-1');
    await buildCopilotSystemPrompt('user-1');
    // getPrompt should only be called once (second call hits cache)
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getPrompt } = require('@/lib/services/prompt-registry');
    expect(getPrompt).toHaveBeenCalledTimes(1);
  });

  it('includes recent performance data when posts have engagement', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return createChain({ voice_profile: { tone: 'direct' }, full_name: 'Tim', title: 'CEO' });
      }
      if (table === 'copilot_memories') {
        return createChain([]);
      }
      if (table === 'cp_pipeline_posts') {
        return createChain([
          {
            draft_content: 'Here is my post about building a great team culture',
            final_content: 'Here is my final post about building a great team culture and leadership',
            engagement_stats: { impressions: 1200, comments: 15, likes: 85 },
            published_at: new Date().toISOString(),
          },
          {
            draft_content: 'Short post',
            final_content: null,
            engagement_stats: { impressions: 500, comments: 3, likes: 20 },
            published_at: new Date().toISOString(),
          },
        ]);
      }
      if (table === 'copilot_conversations') {
        return createChain([]);
      }
      if (table === 'copilot_messages') {
        return createChain([]);
      }
      return createChain();
    });

    const result = await buildCopilotSystemPrompt('user-1');
    expect(result).toContain('Recent Performance (last 30 days)');
    expect(result).toContain('1200 impressions');
    expect(result).toContain('15 comments');
    expect(result).toContain('85 likes');
    // Should use final_content when available (first 50 chars + "...")
    expect(result).toContain('Here is my final post about building a great team ...');
    // Should fallback to draft_content when final_content is null
    expect(result).toContain('Short post');
  });

  it('omits performance section when no published posts', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return createChain({ voice_profile: { tone: 'direct' }, full_name: 'Tim', title: 'CEO' });
      }
      if (table === 'copilot_memories') {
        return createChain([]);
      }
      if (table === 'cp_pipeline_posts') {
        return createChain([]);
      }
      if (table === 'copilot_conversations') {
        return createChain([]);
      }
      if (table === 'copilot_messages') {
        return createChain([]);
      }
      return createChain();
    });

    const result = await buildCopilotSystemPrompt('user-1');
    expect(result).not.toContain('Recent Performance');
  });

  it('includes negative feedback patterns when present', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return createChain({ voice_profile: { tone: 'direct' }, full_name: 'Tim', title: 'CEO' });
      }
      if (table === 'copilot_memories') {
        return createChain([]);
      }
      if (table === 'cp_pipeline_posts') {
        return createChain([]);
      }
      if (table === 'copilot_conversations') {
        return createChain([{ id: 'conv-1' }, { id: 'conv-2' }]);
      }
      if (table === 'copilot_messages') {
        return createChain([
          { feedback: { rating: 'down', note: 'Too formal' } },
          { feedback: { rating: 'down', note: 'Too formal' } },
          { feedback: { rating: 'down', note: 'Missing examples' } },
          { feedback: { rating: 'up', note: 'Great job' } },
          { feedback: { rating: 'down' } }, // no note, should be filtered out
        ]);
      }
      return createChain();
    });

    const result = await buildCopilotSystemPrompt('user-1');
    expect(result).toContain('Feedback Patterns');
    expect(result).toContain('Common corrections from user');
    expect(result).toContain('too formal');
    expect(result).toContain('x2');
    expect(result).toContain('missing examples');
    // Should NOT include positive feedback
    expect(result).not.toContain('Great job');
  });

  it('omits feedback section when no negative feedback', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return createChain({ voice_profile: { tone: 'direct' }, full_name: 'Tim', title: 'CEO' });
      }
      if (table === 'copilot_memories') {
        return createChain([]);
      }
      if (table === 'cp_pipeline_posts') {
        return createChain([]);
      }
      if (table === 'copilot_conversations') {
        return createChain([{ id: 'conv-1' }]);
      }
      if (table === 'copilot_messages') {
        return createChain([
          { feedback: { rating: 'up', note: 'Good response' } },
        ]);
      }
      return createChain();
    });

    const result = await buildCopilotSystemPrompt('user-1');
    expect(result).not.toContain('Feedback Patterns');
  });
});
