// API Route: Analytics Overview
// GET /api/analytics/overview?range=7d|30d|90d
// Returns time-series views/leads, UTM breakdown, and aggregate totals

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

const VALID_RANGES = ['7d', '30d', '90d'] as const;
type Range = (typeof VALID_RANGES)[number];

function parseDays(range: Range): number {
  return parseInt(range.replace('d', ''), 10);
}

function buildDateRange(days: number): string[] {
  const dates: string[] = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    // Parse and validate range
    const url = new URL(request.url);
    const rangeParam = url.searchParams.get('range') || '30d';
    if (!VALID_RANGES.includes(rangeParam as Range)) {
      return ApiErrors.validationError(
        `Invalid range "${rangeParam}". Must be one of: ${VALID_RANGES.join(', ')}`
      );
    }
    const range = rangeParam as Range;
    const days = parseDays(range);
    const dateRange = buildDateRange(days);
    const startDate = dateRange[0];

    const supabase = createSupabaseAdminClient();

    // Get user's funnel IDs
    const { data: funnels, error: funnelsError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('user_id', session.user.id);

    if (funnelsError) {
      logApiError('analytics/overview/funnels', funnelsError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch funnel data');
    }

    const funnelIds = funnels?.map((f: { id: string }) => f.id) || [];

    // If no funnels, return empty response with zero-filled date ranges
    if (funnelIds.length === 0) {
      return NextResponse.json({
        viewsByDay: dateRange.map((date) => ({ date, views: 0 })),
        leadsByDay: dateRange.map((date) => ({ date, leads: 0 })),
        utmBreakdown: [],
        totals: {
          views: 0,
          leads: 0,
          qualified: 0,
          conversionRate: 0,
          qualificationRate: 0,
        },
      });
    }

    // Fetch views and leads in parallel
    const [viewsResult, leadsResult] = await Promise.all([
      supabase
        .from('page_views')
        .select('funnel_page_id, view_date')
        .in('funnel_page_id', funnelIds)
        .gte('view_date', startDate)
        .order('view_date'),
      supabase
        .from('funnel_leads')
        .select('funnel_page_id, is_qualified, utm_source, created_at')
        .in('funnel_page_id', funnelIds)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .order('created_at'),
    ]);

    if (viewsResult.error) {
      logApiError('analytics/overview/views', viewsResult.error, { userId: session.user.id });
    }

    if (leadsResult.error) {
      logApiError('analytics/overview/leads', leadsResult.error, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to fetch lead data');
    }

    const views = viewsResult.data || [];
    const leads = leadsResult.data || [];

    // Aggregate views by day
    const viewsByDateMap = new Map<string, number>();
    for (const view of views) {
      const date = view.view_date;
      viewsByDateMap.set(date, (viewsByDateMap.get(date) || 0) + 1);
    }

    // Aggregate leads by day
    const leadsByDateMap = new Map<string, number>();
    for (const lead of leads) {
      const date = lead.created_at.split('T')[0];
      leadsByDateMap.set(date, (leadsByDateMap.get(date) || 0) + 1);
    }

    // Build time-series arrays, filling in zeros for missing days
    const viewsByDay = dateRange.map((date) => ({
      date,
      views: viewsByDateMap.get(date) || 0,
    }));

    const leadsByDay = dateRange.map((date) => ({
      date,
      leads: leadsByDateMap.get(date) || 0,
    }));

    // UTM breakdown
    const utmCounts = new Map<string, number>();
    let totalQualified = 0;
    for (const lead of leads) {
      const source = lead.utm_source || 'direct';
      utmCounts.set(source, (utmCounts.get(source) || 0) + 1);
      if (lead.is_qualified === true) {
        totalQualified++;
      }
    }

    const utmBreakdown = Array.from(utmCounts.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    // Totals
    const totalViews = views.length;
    const totalLeads = leads.length;

    const totals = {
      views: totalViews,
      leads: totalLeads,
      qualified: totalQualified,
      conversionRate: totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0,
      qualificationRate: totalLeads > 0 ? Math.round((totalQualified / totalLeads) * 100) : 0,
    };

    return NextResponse.json({
      viewsByDay,
      leadsByDay,
      utmBreakdown,
      totals,
    });
  } catch (error) {
    logApiError('analytics/overview', error);
    return ApiErrors.internalError('Failed to fetch analytics');
  }
}
