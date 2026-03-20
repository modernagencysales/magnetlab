/** Mixer Performance Service. Recipe suggestions and combo performance analytics. Never imports from Next.js request/response objects. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';
import { getRecipesByProfile } from '@/server/repositories/mix-recipes.repo';
import type { RecipeSuggestion, ComboPerformance } from '@/lib/types/mixer';

// ─── Recipe suggestions ───────────────────────────────────────────────────────

/** Return top N recipe suggestions for a team profile based on combo performance. */
export async function getSuggestedRecipes(
  teamProfileId: string,
  limit = 5
): Promise<RecipeSuggestion[]> {
  const recipes = await getRecipesByProfile(teamProfileId, 50);
  const withPosts = recipes.filter((r) => r.post_ids && r.post_ids.length > 0);

  if (withPosts.length === 0) return [];

  // Group by exploit_id + knowledge_topic combo
  const groups = new Map<string, typeof withPosts>();
  for (const recipe of withPosts) {
    const key = `${recipe.exploit_id ?? '__none__'}::${recipe.knowledge_topic ?? '__none__'}`;
    const existing = groups.get(key) ?? [];
    existing.push(recipe);
    groups.set(key, existing);
  }

  // Build suggestions from groups, sorted by recency and post count
  const suggestions: RecipeSuggestion[] = [];
  for (const [, groupRecipes] of groups) {
    const totalPosts = groupRecipes.reduce((sum, r) => sum + r.post_ids.length, 0);
    const latest = groupRecipes[0]; // already sorted by created_at DESC from repo

    const ingredients: RecipeSuggestion['ingredients'] = [];
    if (latest.exploit_id) {
      ingredients.push({ type: 'exploits', id: latest.exploit_id, name: 'Exploit' });
    }
    if (latest.knowledge_topic) {
      ingredients.push({ type: 'knowledge', name: latest.knowledge_topic });
    }
    if (latest.style_id) {
      ingredients.push({ type: 'styles', id: latest.style_id, name: 'Style' });
    }
    if (latest.template_id) {
      ingredients.push({ type: 'templates', id: latest.template_id, name: 'Template' });
    }
    if (latest.creative_id) {
      ingredients.push({ type: 'creatives', id: latest.creative_id, name: 'Creative' });
    }

    const ingredientNames = ingredients.map((i) => i.name).join(' + ');
    suggestions.push({
      ingredients,
      combo_name: ingredientNames || 'Custom Mix',
      multiplier: 1.0, // No performance data to compute multiplier without engagement join
      post_count: totalPosts,
      context: `Used ${groupRecipes.length} time${groupRecipes.length !== 1 ? 's' : ''}, ${totalPosts} post${totalPosts !== 1 ? 's' : ''} generated`,
    });
  }

  // Sort by post_count (proxy for performance) then return top N
  suggestions.sort((a, b) => b.post_count - a.post_count);
  return suggestions.slice(0, limit);
}

// ─── Combo performance ────────────────────────────────────────────────────────

/** Return top N ingredient combos sorted by engagement multiplier. */
export async function getComboPerformance(
  teamProfileId: string,
  limit = 10
): Promise<ComboPerformance[]> {
  const supabase = createSupabaseAdminClient();

  // Fetch recipes with posts
  const { data: recipesData, error: recipesError } = await supabase
    .from('cp_mix_recipes')
    .select('id, exploit_id, knowledge_topic, style_id, template_id, post_ids, created_at')
    .eq('team_profile_id', teamProfileId)
    .not('post_ids', 'eq', '{}')
    .order('created_at', { ascending: false });

  if (recipesError) {
    logError('mixer/combo-performance/recipes', recipesError, { teamProfileId });
    throw Object.assign(new Error('Failed to fetch combo performance'), { statusCode: 500 });
  }

  const recipes = (recipesData ?? []) as Array<{
    id: string;
    exploit_id: string | null;
    knowledge_topic: string | null;
    style_id: string | null;
    template_id: string | null;
    post_ids: string[];
    created_at: string;
  }>;

  if (recipes.length === 0) return [];

  // Gather all post IDs
  const allPostIds = [...new Set(recipes.flatMap((r) => r.post_ids))];

  // Collect unique ingredient IDs for name lookups
  const exploitIds = [
    ...new Set(recipes.map((r) => r.exploit_id).filter((id): id is string => !!id)),
  ];
  const styleIds = [...new Set(recipes.map((r) => r.style_id).filter((id): id is string => !!id))];
  const templateIds = [
    ...new Set(recipes.map((r) => r.template_id).filter((id): id is string => !!id)),
  ];

  // Fetch names + engagement in parallel
  const [exploitNames, styleNames, templateNames, engagementData] = await Promise.all([
    exploitIds.length > 0
      ? supabase.from('cp_exploits').select('id, name').in('id', exploitIds)
      : Promise.resolve({ data: [] }),
    styleIds.length > 0
      ? supabase.from('cp_writing_styles').select('id, name').in('id', styleIds)
      : Promise.resolve({ data: [] }),
    templateIds.length > 0
      ? supabase.from('cp_post_templates').select('id, name').in('id', templateIds)
      : Promise.resolve({ data: [] }),
    allPostIds.length > 0
      ? supabase
          .from('cp_pipeline_posts')
          .select('id, engagement_stats')
          .in('id', allPostIds)
          .eq('status', 'published')
      : Promise.resolve({ data: [] }),
  ]);

  const exploitNameById = new Map<string, string>(
    ((exploitNames.data ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name])
  );
  const styleNameById = new Map<string, string>(
    ((styleNames.data ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name])
  );
  const templateNameById = new Map<string, string>(
    ((templateNames.data ?? []) as Array<{ id: string; name: string }>).map((r) => [r.id, r.name])
  );

  const engagementByPostId = new Map<string, number>();
  for (const post of (engagementData.data ?? []) as Array<{
    id: string;
    engagement_stats: { views?: number; likes?: number; comments?: number } | null;
  }>) {
    if (post.engagement_stats) {
      const score =
        (post.engagement_stats.likes ?? 0) * 3 +
        (post.engagement_stats.comments ?? 0) * 5 +
        (post.engagement_stats.views ?? 0) * 0.1;
      engagementByPostId.set(post.id, score);
    }
  }

  // Compute overall profile average
  const allScores = [...engagementByPostId.values()];
  const profileAvg =
    allScores.length > 0 ? allScores.reduce((sum, s) => sum + s, 0) / allScores.length : 0;

  // Compute per-recipe stats and build ComboPerformance entries
  const combos: ComboPerformance[] = recipes.map((recipe) => {
    const scores = recipe.post_ids
      .map((id) => engagementByPostId.get(id))
      .filter((s): s is number => s !== undefined);

    const avgEngagement =
      scores.length > 0 ? scores.reduce((sum, s) => sum + s, 0) / scores.length : 0;
    const multiplier = profileAvg > 0 ? avgEngagement / profileAvg : 0;

    return {
      exploit_name: recipe.exploit_id ? (exploitNameById.get(recipe.exploit_id) ?? null) : null,
      knowledge_topic: recipe.knowledge_topic,
      style_name: recipe.style_id ? (styleNameById.get(recipe.style_id) ?? null) : null,
      template_name: recipe.template_id ? (templateNameById.get(recipe.template_id) ?? null) : null,
      avg_engagement: avgEngagement,
      multiplier,
      post_count: recipe.post_ids.length,
      last_used: recipe.created_at,
    };
  });

  combos.sort((a, b) => b.multiplier - a.multiplier);
  return combos.slice(0, limit);
}
