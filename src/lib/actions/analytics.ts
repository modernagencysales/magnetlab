import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';

registerAction({
  name: 'get_post_performance',
  description: 'Get performance data for posts that have engagement stats. Returns content preview, status, engagement metrics, and publish date.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max posts to return (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data: posts, error } = await supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content, status, engagement_stats, published_at')
      .eq('user_id', ctx.userId)
      .not('engagement_stats', 'is', null)
      .order('created_at', { ascending: false })
      .limit(params.limit || 10);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (posts || []).map(p => ({
        id: p.id,
        content_preview: (p.final_content || p.draft_content || '').slice(0, 100),
        status: p.status,
        engagement_stats: p.engagement_stats,
        published_at: p.published_at,
      })),
      displayHint: 'text',
    };
  },
});

registerAction({
  name: 'get_top_posts',
  description: 'Get the top-performing published posts ranked by engagement. Returns content preview, engagement metrics, and publish date.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max posts to return (default 5)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const supabase = createSupabaseAdminClient();

    const { data: posts, error } = await supabase
      .from('cp_pipeline_posts')
      .select('id, draft_content, final_content, status, engagement_stats, published_at')
      .eq('user_id', ctx.userId)
      .eq('status', 'published')
      .not('engagement_stats', 'is', null)
      .order('created_at', { ascending: false })
      .limit(params.limit || 5);

    if (error) return { success: false, error: error.message };

    return {
      success: true,
      data: (posts || []).map(p => ({
        id: p.id,
        content_preview: (p.final_content || p.draft_content || '').slice(0, 100),
        status: p.status,
        engagement_stats: p.engagement_stats,
        published_at: p.published_at,
      })),
      displayHint: 'text',
    };
  },
});
