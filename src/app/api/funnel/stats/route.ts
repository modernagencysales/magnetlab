// API Route: Get funnel statistics
// GET /api/funnel/stats - Get lead counts, views, and conversion rates for all funnels

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

interface FunnelStats {
  total: number;
  qualified: number;
  unqualified: number;
  views: number;
  conversionRate: number;
  qualificationRate: number;
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Get user's funnel IDs (scoped to team or personal)
    const { data: funnels } = await applyScope(
      supabase
        .from('funnel_pages')
        .select('id'),
      scope
    );

    const funnelIds = funnels?.map((f: { id: string }) => f.id) || [];

    if (funnelIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    // Run lead stats and view stats queries in parallel
    // Use database-level count for efficiency instead of fetching all rows
    const [leadsResult, viewsResult] = await Promise.all([
      // Get leads with just the fields we need for aggregation
      supabase
        .from('funnel_leads')
        .select('funnel_page_id, is_qualified')
        .eq('user_id', session.user.id)
        .in('funnel_page_id', funnelIds),
      // Get views
      supabase
        .from('page_views')
        .select('funnel_page_id')
        .in('funnel_page_id', funnelIds),
    ]);

    if (leadsResult.error) {
      logApiError('funnel/stats/leads', leadsResult.error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch stats');
    }

    if (viewsResult.error) {
      // Table might not exist yet, continue without views
      logApiError('funnel/stats/views', viewsResult.error, { note: 'Non-critical, continuing without views' });
    }

    const leads = leadsResult.data || [];
    const views = viewsResult.data || [];

    // Use a more efficient aggregation with Map
    const leadCounts = new Map<string, { total: number; qualified: number; unqualified: number }>();
    const viewCounts = new Map<string, number>();

    // Initialize counts for all funnels
    for (const funnelId of funnelIds) {
      leadCounts.set(funnelId, { total: 0, qualified: 0, unqualified: 0 });
      viewCounts.set(funnelId, 0);
    }

    // Aggregate leads in a single pass
    for (const lead of leads) {
      const counts = leadCounts.get(lead.funnel_page_id);
      if (counts) {
        counts.total++;
        if (lead.is_qualified === true) {
          counts.qualified++;
        } else if (lead.is_qualified === false) {
          counts.unqualified++;
        }
      }
    }

    // Aggregate views in a single pass
    for (const view of views) {
      const count = viewCounts.get(view.funnel_page_id);
      if (count !== undefined) {
        viewCounts.set(view.funnel_page_id, count + 1);
      }
    }

    // Build final stats object
    const stats: Record<string, FunnelStats> = {};

    for (const funnelId of funnelIds) {
      const leadData = leadCounts.get(funnelId)!;
      const viewCount = viewCounts.get(funnelId) || 0;

      stats[funnelId] = {
        total: leadData.total,
        qualified: leadData.qualified,
        unqualified: leadData.unqualified,
        views: viewCount,
        conversionRate: viewCount > 0 ? Math.round((leadData.total / viewCount) * 100) : 0,
        qualificationRate: leadData.total > 0 ? Math.round((leadData.qualified / leadData.total) * 100) : 0,
      };
    }

    return NextResponse.json({ stats });
  } catch (error) {
    logApiError('funnel/stats', error);
    return ApiErrors.internalError('Failed to fetch stats');
  }
}
