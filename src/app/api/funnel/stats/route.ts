// API Route: Get funnel statistics
// GET /api/funnel/stats - Get lead counts, views, and conversion rates for all funnels

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

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

    const supabase = createSupabaseAdminClient();

    // Get user's funnel IDs first
    const { data: funnels } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('user_id', session.user.id);

    const funnelIds = funnels?.map(f => f.id) || [];

    if (funnelIds.length === 0) {
      return NextResponse.json({ stats: {} });
    }

    // Get lead counts grouped by funnel
    const { data: leads, error: leadsError } = await supabase
      .from('funnel_leads')
      .select('funnel_page_id, is_qualified')
      .eq('user_id', session.user.id);

    if (leadsError) {
      logApiError('funnel/stats/leads', leadsError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch stats');
    }

    // Get view counts grouped by funnel
    const { data: views, error: viewsError } = await supabase
      .from('page_views')
      .select('funnel_page_id')
      .in('funnel_page_id', funnelIds);

    if (viewsError) {
      // Table might not exist yet, continue without views
      logApiError('funnel/stats/views', viewsError, { note: 'Non-critical, continuing without views' });
    }

    // Aggregate counts per funnel
    const stats: Record<string, FunnelStats> = {};

    // Initialize stats for all funnels
    for (const funnelId of funnelIds) {
      stats[funnelId] = {
        total: 0,
        qualified: 0,
        unqualified: 0,
        views: 0,
        conversionRate: 0,
        qualificationRate: 0,
      };
    }

    // Count leads
    for (const lead of leads || []) {
      const funnelId = lead.funnel_page_id;
      if (stats[funnelId]) {
        stats[funnelId].total++;
        if (lead.is_qualified === true) {
          stats[funnelId].qualified++;
        } else if (lead.is_qualified === false) {
          stats[funnelId].unqualified++;
        }
      }
    }

    // Count views
    for (const view of views || []) {
      const funnelId = view.funnel_page_id;
      if (stats[funnelId]) {
        stats[funnelId].views++;
      }
    }

    // Calculate rates
    for (const funnelId of funnelIds) {
      const s = stats[funnelId];
      if (s.views > 0) {
        s.conversionRate = Math.round((s.total / s.views) * 100);
      }
      if (s.total > 0) {
        s.qualificationRate = Math.round((s.qualified / s.total) * 100);
      }
    }

    return NextResponse.json({ stats });
  } catch (error) {
    logApiError('funnel/stats', error);
    return ApiErrors.internalError('Failed to fetch stats');
  }
}
