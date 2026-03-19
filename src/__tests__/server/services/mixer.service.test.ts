/**
 * Tests for mixer.service — ingredient inventory, mix generation, recipe suggestions.
 *
 * @jest-environment node
 */

// ─── Mocks (before imports) ──────────────────────────────────────────────────

const mockSupabaseClient = {
  from: jest.fn(),
  rpc: jest.fn(),
};

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(() => mockSupabaseClient),
}));

jest.mock('@/lib/utils/logger', () => ({
  logError: jest.fn(),
  logWarn: jest.fn(),
  logInfo: jest.fn(),
}));

jest.mock('@/server/repositories/mix-recipes.repo', () => ({
  insertRecipe: jest.fn(),
  getRecipesByProfile: jest.fn(),
  updateRecipePostIds: jest.fn(),
}));

jest.mock('@/lib/ai/content-pipeline/mixer-prompt-builder', () => ({
  buildMixerPrompt: jest.fn(() => 'mock prompt'),
  buildMixerVoiceSection: jest.fn(() => ''),
}));

jest.mock('@/lib/ai/content-pipeline/post-writer', () => ({
  getBaseStyleGuidelines: jest.fn(() => 'mock style guidelines'),
}));

jest.mock('@anthropic-ai/sdk', () => {
  const mockCreate = jest.fn();
  const MockAnthropic = jest.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  }));
  MockAnthropic.__mockCreate = mockCreate;
  return {
    __esModule: true,
    default: MockAnthropic,
    __mockCreate: mockCreate,
  };
});

// ─── Imports (after mocks) ───────────────────────────────────────────────────

import * as mixRecipesRepo from '@/server/repositories/mix-recipes.repo';
import {
  resolveScope,
  getInventory,
  mix,
  getSuggestedRecipes,
  getComboPerformance,
  getStatusCode,
} from '@/server/services/mixer.service';

// ─── Mock helpers ─────────────────────────────────────────────────────────────

const mockInsertRecipe = mixRecipesRepo.insertRecipe as jest.Mock;
const mockGetRecipesByProfile = mixRecipesRepo.getRecipesByProfile as jest.Mock;

// Access the mock create function from the hoisted mock module
// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockAnthropicCreate = (require('@anthropic-ai/sdk') as { __mockCreate: jest.Mock })
  .__mockCreate;

// ─── Chain builder ─────────────────────────────────────────────────────────────

function buildChain(result: { data: unknown; error: unknown; count?: number | null }) {
  const chain: Record<string, jest.Mock> = {};

  const resolve = () => Promise.resolve(result);

  chain.select = jest.fn(() => chain);
  chain.eq = jest.fn(() => chain);
  chain.or = jest.fn(() => chain);
  chain.not = jest.fn(() => chain);
  chain.in = jest.fn(() => chain);
  chain.gte = jest.fn(() => chain);
  chain.lte = jest.fn(() => chain);
  chain.ilike = jest.fn(() => chain);
  chain.contains = jest.fn(() => chain);
  chain.order = jest.fn(() => chain);
  chain.limit = jest.fn(() => chain);
  chain.insert = jest.fn(() => chain);
  chain.update = jest.fn(() => chain);
  chain.single = jest.fn(resolve);
  chain.maybeSingle = jest.fn(resolve);

  Object.defineProperty(chain, 'then', {
    value: (onFulfilled?: (v: unknown) => unknown, onRejected?: (r: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected),
    enumerable: false,
  });

  return chain;
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const TEAM_PROFILE_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = '22222222-2222-2222-2222-222222222222';
const TEAM_ID = '33333333-3333-3333-3333-333333333333';
const RECIPE_ID = '44444444-4444-4444-4444-444444444444';
const EXPLOIT_ID = '55555555-5555-5555-5555-555555555555';

const MOCK_TEAM_PROFILE = {
  id: TEAM_PROFILE_ID,
  team_id: TEAM_ID,
  user_id: USER_ID,
  voice_profile: { tone: 'conversational', signature_phrases: ['Let me show you'] },
};

const MOCK_RECIPE = {
  id: RECIPE_ID,
  team_profile_id: TEAM_PROFILE_ID,
  exploit_id: EXPLOIT_ID,
  knowledge_topic: 'lead generation',
  knowledge_query: null,
  style_id: null,
  template_id: null,
  creative_id: null,
  trend_topic: null,
  recycled_post_id: null,
  instructions: null,
  output_type: 'drafts',
  post_ids: ['post-1', 'post-2'],
  created_at: '2026-03-19T00:00:00Z',
  updated_at: '2026-03-19T00:00:00Z',
};

// ─── resolveScope ─────────────────────────────────────────────────────────────

describe('resolveScope', () => {
  it('returns userId, teamId, teamProfileId when profile found', async () => {
    mockSupabaseClient.from.mockReturnValue(buildChain({ data: MOCK_TEAM_PROFILE, error: null }));

    const result = await resolveScope(TEAM_PROFILE_ID);

    expect(result).toEqual({
      userId: USER_ID,
      teamId: TEAM_ID,
      teamProfileId: TEAM_PROFILE_ID,
    });
  });

  it('throws 404 when profile not found', async () => {
    mockSupabaseClient.from.mockReturnValue(
      buildChain({ data: null, error: { code: 'PGRST116', message: 'Not found' } })
    );

    await expect(resolveScope(TEAM_PROFILE_ID)).rejects.toMatchObject({
      message: 'Team profile not found',
      statusCode: 404,
    });
  });
});

// ─── getInventory ──────────────────────────────────────────────────────────────

describe('getInventory', () => {
  beforeEach(() => {
    // resolveScope call returns profile
    mockSupabaseClient.from.mockReturnValue(
      buildChain({
        data: MOCK_TEAM_PROFILE,
        error: null,
        count: 0,
      })
    );
  });

  it('returns counts for all 7 ingredient types', async () => {
    // Mock resolveScope query + 10 parallel count queries
    // resolveScope uses .from('team_profiles').select(...).eq(...).single()
    // The inventory queries use head:true (count only) or head:false (data)
    let callIndex = 0;
    mockSupabaseClient.from.mockImplementation((table: string) => {
      callIndex++;

      // First call is resolveScope
      if (callIndex === 1) {
        return buildChain({ data: MOCK_TEAM_PROFILE, error: null, count: null });
      }

      // Subsequent calls are inventory queries — return varying counts
      const countMocks: Record<string, number> = {
        cp_knowledge_entries: 15,
        cp_exploits: 8,
        cp_writing_styles: 3,
        cp_post_templates: 20,
        cp_creatives: 12,
        cp_pipeline_posts: 6,
      };
      const count = countMocks[table] ?? 0;
      return buildChain({ data: [], error: null, count });
    });

    const result = await getInventory(TEAM_PROFILE_ID);

    expect(result.team_profile_id).toBe(TEAM_PROFILE_ID);
    expect(result.ingredients).toHaveLength(7);

    const types = result.ingredients.map((i) => i.type);
    expect(types).toContain('knowledge');
    expect(types).toContain('exploits');
    expect(types).toContain('styles');
    expect(types).toContain('templates');
    expect(types).toContain('creatives');
    expect(types).toContain('trends');
    expect(types).toContain('recycled');
  });
});

// ─── mix ──────────────────────────────────────────────────────────────────────

describe('mix', () => {
  const DRAFTS_RESPONSE = JSON.stringify([
    { content: 'Post draft 1', hook_type: 'story', angle: 'Personal experience' },
    { content: 'Post draft 2', hook_type: 'insight', angle: 'Industry insight' },
    { content: 'Post draft 3', hook_type: 'tip', angle: 'Practical advice' },
  ]);

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: all Supabase calls succeed
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return buildChain({ data: MOCK_TEAM_PROFILE, error: null });
      }
      if (table === 'cp_exploits') {
        return buildChain({
          data: {
            name: 'Commentary',
            description: 'Write a commentary post',
            prompt_template: null,
            example_posts: ['Example post 1'],
          },
          error: null,
        });
      }
      return buildChain({ data: null, error: null });
    });

    mockSupabaseClient.rpc.mockResolvedValue({ data: null, error: { message: 'not found' } });

    mockInsertRecipe.mockResolvedValue(MOCK_RECIPE);

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: DRAFTS_RESPONSE }],
    });
  });

  it('returns drafts when output=drafts and exploit provided', async () => {
    const result = await mix({
      team_profile_id: TEAM_PROFILE_ID,
      exploit_id: EXPLOIT_ID,
      count: 3,
      output: 'drafts',
    });

    expect(result.type).toBe('drafts');
    if (result.type === 'drafts') {
      expect(result.drafts).toHaveLength(3);
      expect(result.drafts[0].content).toBe('Post draft 1');
      expect(result.drafts[0].recipe_id).toBe(RECIPE_ID);
      expect(result.drafts[0].ai_pick).toBe(true);
      expect(result.drafts[1].ai_pick).toBe(false);
    }
  });

  it('inserts a recipe into cp_mix_recipes', async () => {
    await mix({
      team_profile_id: TEAM_PROFILE_ID,
      exploit_id: EXPLOIT_ID,
      count: 3,
      output: 'drafts',
    });

    expect(mockInsertRecipe).toHaveBeenCalledWith(
      expect.objectContaining({
        team_profile_id: TEAM_PROFILE_ID,
        output_type: 'drafts',
        exploit_id: EXPLOIT_ID,
      })
    );
  });

  it('returns ideas when output=ideas', async () => {
    const IDEAS_RESPONSE = JSON.stringify([
      {
        title: 'How to double leads',
        core_insight: 'Focus on quality not quantity',
        hook: 'I doubled my leads without spending more',
        key_points: ['Quality ICP', 'Clear value prop'],
        content_type: 'insight',
        relevance_score: 0.9,
      },
    ]);

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: IDEAS_RESPONSE }],
    });

    // Mock idea insert
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'team_profiles') {
        return buildChain({ data: MOCK_TEAM_PROFILE, error: null });
      }
      if (table === 'cp_exploits') {
        return buildChain({
          data: {
            name: 'Commentary',
            description: 'Commentary format',
            prompt_template: null,
            example_posts: [],
          },
          error: null,
        });
      }
      if (table === 'cp_content_ideas') {
        return buildChain({ data: [{ id: 'idea-1' }], error: null });
      }
      return buildChain({ data: null, error: null });
    });

    mockInsertRecipe.mockResolvedValue({ ...MOCK_RECIPE, output_type: 'ideas' });

    const result = await mix({
      team_profile_id: TEAM_PROFILE_ID,
      exploit_id: EXPLOIT_ID,
      count: 1,
      output: 'ideas',
    });

    expect(result.type).toBe('ideas');
    if (result.type === 'ideas') {
      expect(result.ideas).toHaveLength(1);
      expect(result.ideas[0].title).toBe('How to double leads');
      expect(result.ideas[0].recipe_id).toBe(RECIPE_ID);
    }
  });
});

// ─── getSuggestedRecipes ───────────────────────────────────────────────────────

describe('getSuggestedRecipes', () => {
  it('returns empty array for new profile with no recipes', async () => {
    mockGetRecipesByProfile.mockResolvedValue([]);

    const result = await getSuggestedRecipes(TEAM_PROFILE_ID);

    expect(result).toEqual([]);
  });

  it('returns empty array when all recipes have no posts', async () => {
    mockGetRecipesByProfile.mockResolvedValue([
      { ...MOCK_RECIPE, post_ids: [] },
      { ...MOCK_RECIPE, id: 'recipe-2', post_ids: [] },
    ]);

    const result = await getSuggestedRecipes(TEAM_PROFILE_ID);

    expect(result).toEqual([]);
  });

  it('returns suggestions when recipes have posts', async () => {
    mockGetRecipesByProfile.mockResolvedValue([MOCK_RECIPE]);

    const result = await getSuggestedRecipes(TEAM_PROFILE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].post_count).toBe(2);
    expect(result[0].ingredients.some((i) => i.type === 'exploits')).toBe(true);
    expect(result[0].ingredients.some((i) => i.type === 'knowledge')).toBe(true);
  });
});

// ─── getComboPerformance ───────────────────────────────────────────────────────

describe('getComboPerformance', () => {
  it('returns empty array for profile with no recipes', async () => {
    mockSupabaseClient.from.mockReturnValue(buildChain({ data: [], error: null }));

    const result = await getComboPerformance(TEAM_PROFILE_ID);

    expect(result).toEqual([]);
  });

  it('returns combo entries sorted by multiplier', async () => {
    mockSupabaseClient.from.mockImplementation((table: string) => {
      if (table === 'cp_mix_recipes') {
        return buildChain({
          data: [
            {
              ...MOCK_RECIPE,
              post_ids: ['post-1', 'post-2'],
            },
          ],
          error: null,
        });
      }

      if (table === 'cp_pipeline_posts') {
        return buildChain({
          data: [
            {
              id: 'post-1',
              engagement_stats: { views: 1000, likes: 50, comments: 10 },
            },
            {
              id: 'post-2',
              engagement_stats: { views: 2000, likes: 100, comments: 20 },
            },
          ],
          error: null,
        });
      }

      return buildChain({ data: [], error: null });
    });

    const result = await getComboPerformance(TEAM_PROFILE_ID);

    expect(result).toHaveLength(1);
    expect(result[0].post_count).toBe(2);
    expect(result[0].avg_engagement).toBeGreaterThan(0);
    expect(result[0].multiplier).toBeGreaterThanOrEqual(0);
    expect(result[0].knowledge_topic).toBe('lead generation');
    expect(result[0].last_used).toBe('2026-03-19T00:00:00Z');
  });
});

// ─── getStatusCode ─────────────────────────────────────────────────────────────

describe('getStatusCode', () => {
  it('returns 404 from error with statusCode 404', () => {
    const err = Object.assign(new Error('Not found'), { statusCode: 404 });
    expect(getStatusCode(err)).toBe(404);
  });

  it('returns 500 for unknown errors', () => {
    expect(getStatusCode(new Error('boom'))).toBe(500);
    expect(getStatusCode('string error')).toBe(500);
    expect(getStatusCode(null)).toBe(500);
  });
});
