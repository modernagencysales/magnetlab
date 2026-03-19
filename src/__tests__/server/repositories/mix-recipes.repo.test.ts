/**
 * @jest-environment node
 *
 * Tests for src/server/repositories/mix-recipes.repo.ts
 * All Supabase calls are mocked via createSupabaseAdminClient.
 */

import {
  getRecipesByProfile,
  getRecipeById,
  insertRecipe,
  updateRecipePostIds,
} from '@/server/repositories/mix-recipes.repo';
import type { InsertMixRecipe } from '@/server/repositories/mix-recipes.repo';

// ─── Mocks ───────────────────────────────────────────────────────────────────

jest.mock('@/lib/utils/supabase-server', () => ({
  createSupabaseAdminClient: jest.fn(),
}));

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

// ─── Mock chain builder ──────────────────────────────────────────────────────

/**
 * Creates a chainable mock Supabase client.
 * All query builder methods return the chain itself.
 * Terminal calls (single) resolve to result.
 * Awaiting the chain directly resolves via .then (for list queries).
 */
function createMockChain(result: { data: unknown; error: unknown } = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {};

  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'order', 'limit'];

  for (const m of methods) {
    chain[m] = jest.fn(() => chain);
  }

  // Terminal: resolves with result
  chain.single = jest.fn(() => Promise.resolve(result));

  // For list queries (no terminal call) — resolved by awaiting
  chain.then = jest.fn((resolve: (val: unknown) => void) => resolve(result));

  return chain;
}

function setupMockClient(results: Array<{ data: unknown; error: unknown }> = []) {
  let callIndex = 0;
  const defaultResult = { data: null, error: null };

  const client = {
    from: jest.fn(() => {
      const result = results[callIndex] ?? defaultResult;
      callIndex++;
      return createMockChain(result);
    }),
  };

  (createSupabaseAdminClient as jest.Mock).mockReturnValue(client);
  return client;
}

// ─── Test data ───────────────────────────────────────────────────────────────

const RECIPE_ROW = {
  id: 'recipe-1',
  team_profile_id: 'profile-1',
  exploit_id: 'exploit-1',
  knowledge_topic: 'Positioning',
  knowledge_query: 'how to stand out',
  style_id: 'style-1',
  template_id: null,
  creative_id: null,
  trend_topic: null,
  recycled_post_id: null,
  instructions: 'Keep it punchy.',
  output_type: 'drafts',
  post_ids: [],
  created_at: '2026-03-19T10:00:00Z',
  updated_at: '2026-03-19T10:00:00Z',
};

const INSERT_INPUT: InsertMixRecipe = {
  team_profile_id: 'profile-1',
  output_type: 'drafts',
  exploit_id: 'exploit-1',
  knowledge_topic: 'Positioning',
  knowledge_query: 'how to stand out',
  style_id: 'style-1',
  instructions: 'Keep it punchy.',
};

// ─── insertRecipe ────────────────────────────────────────────────────────────

describe('insertRecipe', () => {
  it('calls supabase insert with correct data and returns the created row', async () => {
    const client = setupMockClient([{ data: RECIPE_ROW, error: null }]);
    const chain = createMockChain({ data: RECIPE_ROW, error: null });
    client.from.mockReturnValue(chain);

    const result = await insertRecipe(INSERT_INPUT);

    expect(result).toEqual(RECIPE_ROW);
    expect(client.from).toHaveBeenCalledWith('cp_mix_recipes');
    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        team_profile_id: 'profile-1',
        output_type: 'drafts',
        exploit_id: 'exploit-1',
        knowledge_topic: 'Positioning',
        style_id: 'style-1',
        instructions: 'Keep it punchy.',
      })
    );
    expect(chain.single).toHaveBeenCalled();
  });

  it('coerces undefined optional fields to null', async () => {
    const client = setupMockClient([{ data: RECIPE_ROW, error: null }]);
    const chain = createMockChain({ data: RECIPE_ROW, error: null });
    client.from.mockReturnValue(chain);

    const minimalInput: InsertMixRecipe = {
      team_profile_id: 'profile-1',
      output_type: 'ideas',
    };

    await insertRecipe(minimalInput);

    expect(chain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        exploit_id: null,
        knowledge_topic: null,
        knowledge_query: null,
        style_id: null,
        template_id: null,
        creative_id: null,
        trend_topic: null,
        recycled_post_id: null,
        instructions: null,
      })
    );
  });

  it('throws with statusCode 500 on supabase error', async () => {
    const client = setupMockClient([{ data: null, error: { message: 'insert failed' } }]);
    const chain = createMockChain({ data: null, error: { message: 'insert failed', code: 'X' } });
    client.from.mockReturnValue(chain);

    await expect(insertRecipe(INSERT_INPUT)).rejects.toMatchObject({
      message: expect.stringContaining('insert failed'),
      statusCode: 500,
    });
  });
});

// ─── getRecipesByProfile ─────────────────────────────────────────────────────

describe('getRecipesByProfile', () => {
  it('filters by team_profile_id and orders by created_at DESC', async () => {
    const rows = [RECIPE_ROW];
    const client = setupMockClient([{ data: rows, error: null }]);
    const chain = createMockChain({ data: rows, error: null });
    client.from.mockReturnValue(chain);

    const result = await getRecipesByProfile('profile-1');

    expect(result).toEqual(rows);
    expect(client.from).toHaveBeenCalledWith('cp_mix_recipes');
    expect(chain.eq).toHaveBeenCalledWith('team_profile_id', 'profile-1');
    expect(chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it('respects custom limit parameter', async () => {
    const client = setupMockClient([{ data: [], error: null }]);
    const chain = createMockChain({ data: [], error: null });
    client.from.mockReturnValue(chain);

    await getRecipesByProfile('profile-1', 10);

    expect(chain.limit).toHaveBeenCalledWith(10);
  });

  it('returns empty array when no recipes exist', async () => {
    setupMockClient([{ data: [], error: null }]);

    const result = await getRecipesByProfile('profile-empty');

    expect(result).toEqual([]);
  });

  it('throws with statusCode 500 on supabase error', async () => {
    setupMockClient([{ data: null, error: { message: 'query failed' } }]);

    await expect(getRecipesByProfile('profile-1')).rejects.toMatchObject({
      message: expect.stringContaining('query failed'),
      statusCode: 500,
    });
  });
});

// ─── getRecipeById ───────────────────────────────────────────────────────────

describe('getRecipeById', () => {
  it('returns the recipe when found', async () => {
    const client = setupMockClient([{ data: RECIPE_ROW, error: null }]);
    const chain = createMockChain({ data: RECIPE_ROW, error: null });
    client.from.mockReturnValue(chain);

    const result = await getRecipeById('recipe-1');

    expect(result).toEqual(RECIPE_ROW);
    expect(chain.eq).toHaveBeenCalledWith('id', 'recipe-1');
    expect(chain.single).toHaveBeenCalled();
  });

  it('returns null on PGRST116 (not found) error', async () => {
    const client = setupMockClient([
      { data: null, error: { code: 'PGRST116', message: 'no rows' } },
    ]);
    const chain = createMockChain({
      data: null,
      error: { code: 'PGRST116', message: 'no rows' },
    });
    client.from.mockReturnValue(chain);

    const result = await getRecipeById('recipe-missing');

    expect(result).toBeNull();
  });

  it('throws with statusCode 500 on non-PGRST116 supabase error', async () => {
    const client = setupMockClient([
      { data: null, error: { code: '500', message: 'connection error' } },
    ]);
    const chain = createMockChain({
      data: null,
      error: { code: '500', message: 'connection error' },
    });
    client.from.mockReturnValue(chain);

    await expect(getRecipeById('recipe-1')).rejects.toMatchObject({
      message: expect.stringContaining('connection error'),
      statusCode: 500,
    });
  });
});

// ─── updateRecipePostIds ─────────────────────────────────────────────────────

describe('updateRecipePostIds', () => {
  it('calls update with post_ids array', async () => {
    const client = setupMockClient([{ data: null, error: null }]);
    const chain = createMockChain({ data: null, error: null });
    client.from.mockReturnValue(chain);

    const postIds = ['post-1', 'post-2', 'post-3'];
    await updateRecipePostIds('recipe-1', postIds);

    expect(client.from).toHaveBeenCalledWith('cp_mix_recipes');
    expect(chain.update).toHaveBeenCalledWith({ post_ids: postIds });
    expect(chain.eq).toHaveBeenCalledWith('id', 'recipe-1');
  });

  it('accepts an empty post_ids array', async () => {
    const client = setupMockClient([{ data: null, error: null }]);
    const chain = createMockChain({ data: null, error: null });
    client.from.mockReturnValue(chain);

    await updateRecipePostIds('recipe-1', []);

    expect(chain.update).toHaveBeenCalledWith({ post_ids: [] });
  });

  it('throws with statusCode 500 on supabase error', async () => {
    const client = setupMockClient([{ data: null, error: { message: 'update failed' } }]);
    const chain = createMockChain({ data: null, error: { message: 'update failed' } });
    client.from.mockReturnValue(chain);

    await expect(updateRecipePostIds('recipe-1', ['post-1'])).rejects.toMatchObject({
      message: expect.stringContaining('update failed'),
      statusCode: 500,
    });
  });
});
