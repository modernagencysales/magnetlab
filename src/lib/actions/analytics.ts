/**
 * Analytics copilot actions.
 * All data access goes through repos — no raw Supabase queries.
 */

import { registerAction } from './registry';
import type { ActionContext, ActionResult } from './types';
import { findPosts } from '@/server/repositories/posts.repo';

registerAction({
  name: 'get_post_performance',
  description: 'Get performance data for posts that have engagement stats. Returns content preview, status, engagement metrics, and publish date.',
  parameters: {
    properties: {
      limit: { type: 'number', description: 'Max posts to return (default 10)' },
    },
  },
  handler: async (ctx: ActionContext, params: { limit?: number }): Promise<ActionResult> => {
    const posts = await findPosts(ctx.scope, { limit: params.limit || 10 });

    // Filter to posts with engagement stats (JSONB filtering not supported in PostFilters)
    const withStats = posts.filter((p) => p.engagement_stats != null);

    return {
      success: true,
      data: withStats.map((p) => ({
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
    const requestedLimit = params.limit || 5;

    // Fetch published posts (up to 100) then sort client-side by total engagement
    // (JSONB fields cannot be reliably sorted via PostgREST)
    const posts = await findPosts(ctx.scope, { status: 'published', limit: 100 });

    const withStats = posts.filter((p) => p.engagement_stats != null);

    const sorted = withStats
      .sort((a, b) => {
        const statsA = (a.engagement_stats || {}) as Record<string, number>;
        const statsB = (b.engagement_stats || {}) as Record<string, number>;
        const totalA = (statsA.likes || 0) + (statsA.comments || 0) + (statsA.shares || 0) + (statsA.impressions || 0);
        const totalB = (statsB.likes || 0) + (statsB.comments || 0) + (statsB.shares || 0) + (statsB.impressions || 0);
        return totalB - totalA;
      })
      .slice(0, requestedLimit);

    return {
      success: true,
      data: sorted.map((p) => ({
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
