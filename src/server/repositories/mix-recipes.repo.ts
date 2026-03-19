/** Mix recipes repository. CRUD for cp_mix_recipes table. Never imports from Next.js or React. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { MixRecipe } from '@/lib/types/mixer';

// ─── Column constants ────────────────────────────────────────────────────────

const MIX_RECIPE_COLUMNS =
  'id, team_profile_id, exploit_id, knowledge_topic, knowledge_query, style_id, template_id, creative_id, trend_topic, recycled_post_id, idea_id, instructions, output_type, post_ids, created_at, updated_at';

// ─── Input types ─────────────────────────────────────────────────────────────

export interface InsertMixRecipe {
  team_profile_id: string;
  output_type: 'drafts' | 'ideas';
  exploit_id?: string | null;
  knowledge_topic?: string | null;
  knowledge_query?: string | null;
  style_id?: string | null;
  template_id?: string | null;
  creative_id?: string | null;
  trend_topic?: string | null;
  recycled_post_id?: string | null;
  idea_id?: string | null;
  instructions?: string | null;
}

// ─── Read operations ─────────────────────────────────────────────────────────

/** Fetch all recipes for a team profile, newest first. */
export async function getRecipesByProfile(teamProfileId: string, limit = 50): Promise<MixRecipe[]> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_mix_recipes')
    .select(MIX_RECIPE_COLUMNS)
    .eq('team_profile_id', teamProfileId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw Object.assign(new Error(`mix-recipes.getRecipesByProfile: ${error.message}`), {
      statusCode: 500,
    });
  }

  return (data ?? []) as unknown as MixRecipe[];
}

/** Fetch a single recipe by ID. Returns null if not found (PGRST116). */
export async function getRecipeById(id: string): Promise<MixRecipe | null> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_mix_recipes')
    .select(MIX_RECIPE_COLUMNS)
    .eq('id', id)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null;
    throw Object.assign(new Error(`mix-recipes.getRecipeById: ${error.message}`), {
      statusCode: 500,
    });
  }

  return data as unknown as MixRecipe;
}

// ─── Write operations ────────────────────────────────────────────────────────

/** Insert a new mix recipe row and return the created record. */
export async function insertRecipe(input: InsertMixRecipe): Promise<MixRecipe> {
  const supabase = createSupabaseAdminClient();

  const { data, error } = await supabase
    .from('cp_mix_recipes')
    .insert({
      team_profile_id: input.team_profile_id,
      output_type: input.output_type,
      exploit_id: input.exploit_id ?? null,
      knowledge_topic: input.knowledge_topic ?? null,
      knowledge_query: input.knowledge_query ?? null,
      style_id: input.style_id ?? null,
      template_id: input.template_id ?? null,
      creative_id: input.creative_id ?? null,
      trend_topic: input.trend_topic ?? null,
      recycled_post_id: input.recycled_post_id ?? null,
      idea_id: input.idea_id ?? null,
      instructions: input.instructions ?? null,
    })
    .select(MIX_RECIPE_COLUMNS)
    .single();

  if (error) {
    throw Object.assign(new Error(`mix-recipes.insertRecipe: ${error.message}`), {
      statusCode: 500,
    });
  }

  return data as unknown as MixRecipe;
}

/** Update the post_ids array on an existing recipe (after generation). */
export async function updateRecipePostIds(recipeId: string, postIds: string[]): Promise<void> {
  const supabase = createSupabaseAdminClient();

  const { error } = await supabase
    .from('cp_mix_recipes')
    .update({ post_ids: postIds })
    .eq('id', recipeId);

  if (error) {
    throw Object.assign(new Error(`mix-recipes.updateRecipePostIds: ${error.message}`), {
      statusCode: 500,
    });
  }
}
