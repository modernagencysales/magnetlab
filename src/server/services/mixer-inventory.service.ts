/** Mixer Inventory Service. Fetches counts and health indicators for all 7 ingredient types. Never imports from Next.js request/response objects. */

import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import type { IngredientInventory } from '@/lib/types/mixer';
import { resolveScope } from './mixer.service';

// ─── Inventory ────────────────────────────────────────────────────────────────

/** Return counts and health indicators for all 7 ingredient types. */
export async function getInventory(teamProfileId: string): Promise<IngredientInventory> {
  const { userId, teamId } = await resolveScope(teamProfileId);
  const supabase = createSupabaseAdminClient();

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    knowledgeResult,
    exploitsResult,
    stylesResult,
    activeStylesResult,
    templatesResult,
    creativesResult,
    newCreativesResult,
    trendsResult,
    recycledResult,
    knowledgeTopicsResult,
  ] = await Promise.all([
    // Knowledge: count with team_profile_id scope
    supabase
      .from('cp_knowledge_entries')
      .select('id', { count: 'exact', head: true })
      .eq('team_profile_id', teamProfileId),

    // Exploits: own + global
    supabase
      .from('cp_exploits')
      .select('id', { count: 'exact', head: true })
      .or(`is_global.eq.true,user_id.eq.${userId}`)
      .eq('is_active', true),

    // Styles: count for team_profile_id
    supabase
      .from('cp_writing_styles')
      .select('id', { count: 'exact', head: true })
      .eq('team_profile_id', teamProfileId),

    // Active styles: check if any is_active
    supabase
      .from('cp_writing_styles')
      .select('id', { count: 'exact', head: true })
      .eq('team_profile_id', teamProfileId)
      .eq('is_active', true),

    // Templates: own + team + global
    supabase
      .from('cp_post_templates')
      .select('id', { count: 'exact', head: true })
      .or(`is_global.eq.true,user_id.eq.${userId},team_id.eq.${teamId}`),

    // Creatives: own + team
    supabase
      .from('cp_creatives')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},team_id.eq.${teamId}`),

    // New creatives: status = 'new'
    supabase
      .from('cp_creatives')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},team_id.eq.${teamId}`)
      .eq('status', 'new'),

    // Trends: distinct topics from recent creatives (last 7 days)
    supabase
      .from('cp_creatives')
      .select('topic', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},team_id.eq.${teamId}`)
      .not('topic', 'is', null)
      .gte('created_at', sevenDaysAgo),

    // Recycled: published posts with some engagement
    supabase
      .from('cp_pipeline_posts')
      .select('id', { count: 'exact', head: true })
      .eq('team_profile_id', teamProfileId)
      .eq('status', 'published')
      .not('engagement_stats', 'is', null),

    // Knowledge topics: count distinct topics
    supabase
      .from('cp_knowledge_entries')
      .select('topics', { count: 'exact', head: false })
      .eq('team_profile_id', teamProfileId)
      .not('topics', 'is', null),
  ]);

  const knowledgeCount = knowledgeResult.count ?? 0;
  const exploitsCount = exploitsResult.count ?? 0;
  const stylesCount = stylesResult.count ?? 0;
  const activeStylesCount = activeStylesResult.count ?? 0;
  const templatesCount = templatesResult.count ?? 0;
  const creativesCount = creativesResult.count ?? 0;
  const newCreativesCount = newCreativesResult.count ?? 0;
  const trendsCount = trendsResult.count ?? 0;
  const recycledCount = recycledResult.count ?? 0;

  // Compute distinct topic count from knowledge entries
  const topicsRaw = (knowledgeTopicsResult.data ?? []) as Array<{ topics: string[] | null }>;
  const distinctTopics = new Set<string>();
  for (const row of topicsRaw) {
    if (row.topics) {
      for (const t of row.topics) {
        distinctTopics.add(t);
      }
    }
  }
  const topicCount = distinctTopics.size;

  return {
    team_profile_id: teamProfileId,
    ingredients: [
      {
        type: 'knowledge',
        count: knowledgeCount,
        health: knowledgeCount > 10 ? 'healthy' : null,
        health_detail: knowledgeCount > 10 ? 'Strong knowledge base' : null,
        sub_label: topicCount > 0 ? `${topicCount} topic${topicCount !== 1 ? 's' : ''}` : null,
      },
      {
        type: 'exploits',
        count: exploitsCount,
        health: exploitsCount > 5 ? 'healthy' : null,
        health_detail: exploitsCount > 5 ? 'Good exploit library' : null,
        sub_label: null,
      },
      {
        type: 'styles',
        count: stylesCount,
        health: activeStylesCount > 0 ? 'active' : null,
        health_detail: activeStylesCount > 0 ? `${activeStylesCount} active` : null,
        sub_label: null,
      },
      {
        type: 'templates',
        count: templatesCount,
        health: null,
        health_detail: null,
        sub_label: null,
      },
      {
        type: 'creatives',
        count: creativesCount,
        health: newCreativesCount > 0 ? 'new' : null,
        health_detail: newCreativesCount > 0 ? `${newCreativesCount} new` : null,
        sub_label: null,
      },
      {
        type: 'trends',
        count: trendsCount,
        health: null,
        health_detail: null,
        sub_label: trendsCount > 0 ? `Last 7 days` : null,
      },
      {
        type: 'recycled',
        count: recycledCount,
        health: null,
        health_detail: null,
        sub_label: null,
      },
    ],
  };
}
