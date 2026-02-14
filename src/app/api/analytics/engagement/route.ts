// API Route: Engagement Analytics
// GET /api/analytics/engagement
// Returns aggregated engagement metrics (comments, reactions, DMs) per published post

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

interface EngagementTotals {
  comments: number;
  reactions: number;
  dmsSent: number;
  dmsFailed: number;
}

interface PostEngagementRow {
  postId: string;
  title: string;
  publishedAt: string | null;
  comments: number;
  reactions: number;
  dmsSent: number;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const supabase = createSupabaseAdminClient();
    const userId = session.user.id;

    // 1. Get user's published posts
    const { data: posts, error: postsError } = await supabase
      .from('cp_pipeline_posts')
      .select('id, title, published_at, linkedin_post_id')
      .eq('user_id', userId)
      .eq('status', 'published')
      .order('published_at', { ascending: false });

    if (postsError) {
      logApiError('analytics/engagement/posts', postsError, { userId });
      return ApiErrors.databaseError('Failed to fetch published posts');
    }

    const publishedPosts = posts || [];

    if (publishedPosts.length === 0) {
      return NextResponse.json({
        totals: { comments: 0, reactions: 0, dmsSent: 0, dmsFailed: 0 },
        byPost: [],
      });
    }

    const postIds = publishedPosts.map((p: { id: string }) => p.id);

    // 2. Query cp_post_engagements for engagement counts
    const engagementsByPost: Record<string, { comments: number; reactions: number }> = {};
    let totalComments = 0;
    let totalReactions = 0;

    try {
      const { data: engagements, error: engError } = await supabase
        .from('cp_post_engagements')
        .select('post_id, engagement_type')
        .in('post_id', postIds);

      if (engError) {
        // Table may not exist or have data yet -- log and continue with zeros
        logApiError('analytics/engagement/engagements', engError, { userId });
      } else if (engagements) {
        for (const eng of engagements) {
          const pid = eng.post_id as string;
          if (!engagementsByPost[pid]) {
            engagementsByPost[pid] = { comments: 0, reactions: 0 };
          }
          if (eng.engagement_type === 'comment') {
            engagementsByPost[pid].comments++;
            totalComments++;
          } else if (eng.engagement_type === 'reaction') {
            engagementsByPost[pid].reactions++;
            totalReactions++;
          }
        }
      }
    } catch {
      // Gracefully handle if table doesn't exist
      logApiError('analytics/engagement/engagements-catch', 'cp_post_engagements query failed', { userId });
    }

    // 3. Query linkedin_automation_events for DM counts
    // Events are linked through linkedin_automations which have post_id
    const dmsByPost: Record<string, number> = {};
    let totalDmsSent = 0;
    let totalDmsFailed = 0;

    try {
      // First get the user's automations with their post_id mappings
      const { data: automations, error: autoError } = await supabase
        .from('linkedin_automations')
        .select('id, post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      if (autoError) {
        logApiError('analytics/engagement/automations', autoError, { userId });
      } else if (automations && automations.length > 0) {
        const automationIds = automations.map((a: { id: string }) => a.id);
        const automationToPost: Record<string, string> = {};
        for (const a of automations) {
          if (a.post_id) {
            automationToPost[a.id] = a.post_id;
          }
        }

        // Get DM events for these automations
        const { data: events, error: eventsError } = await supabase
          .from('linkedin_automation_events')
          .select('automation_id, event_type')
          .in('automation_id', automationIds)
          .in('event_type', ['dm_sent', 'dm_failed']);

        if (eventsError) {
          logApiError('analytics/engagement/events', eventsError, { userId });
        } else if (events) {
          for (const ev of events) {
            const postId = automationToPost[ev.automation_id];

            if (ev.event_type === 'dm_sent') {
              totalDmsSent++;
              if (postId) {
                dmsByPost[postId] = (dmsByPost[postId] || 0) + 1;
              }
            } else if (ev.event_type === 'dm_failed') {
              totalDmsFailed++;
            }
          }
        }
      }
    } catch {
      // Gracefully handle if tables don't exist
      logApiError('analytics/engagement/events-catch', 'automation events query failed', { userId });
    }

    // 4. Build per-post breakdown
    const byPost: PostEngagementRow[] = publishedPosts.map(
      (p: { id: string; title: string | null; published_at: string | null }) => ({
        postId: p.id,
        title: p.title || 'Untitled Post',
        publishedAt: p.published_at,
        comments: engagementsByPost[p.id]?.comments || 0,
        reactions: engagementsByPost[p.id]?.reactions || 0,
        dmsSent: dmsByPost[p.id] || 0,
      })
    );

    const totals: EngagementTotals = {
      comments: totalComments,
      reactions: totalReactions,
      dmsSent: totalDmsSent,
      dmsFailed: totalDmsFailed,
    };

    return NextResponse.json({ totals, byPost });
  } catch (error) {
    logApiError('analytics/engagement', error);
    return ApiErrors.internalError('Failed to fetch engagement analytics');
  }
}
