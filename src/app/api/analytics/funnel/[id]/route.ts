// API Route: Per-Funnel Analytics Detail
// GET /api/analytics/funnel/[id]?range=7d|30d|90d
// Returns time-series views/leads, lead table, and aggregate totals for a specific funnel

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { VALID_RANGES, parseDays, buildDateRange, type Range } from '@/lib/utils/analytics-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: funnelId } = await params;

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
    const scope = await getDataScope(session.user.id);

    // Verify funnel ownership: must match both id and scope
    let funnelQuery = supabase
      .from('funnel_pages')
      .select('id, slug, optin_headline')
      .eq('id', funnelId);
    funnelQuery = applyScope(funnelQuery, scope);
    const { data: funnel, error: funnelError } = await funnelQuery.single();

    if (funnelError && funnelError.code !== 'PGRST116') {
      // Actual database error (not a "row not found")
      logApiError('analytics/funnel/detail', funnelError, { userId: session.user.id, funnelId });
      return ApiErrors.databaseError('Failed to fetch funnel data');
    }

    if (!funnel) {
      // Row not found — either funnel doesn't exist or user doesn't own it
      return ApiErrors.forbidden('You do not have access to this funnel');
    }

    // Fetch optin views, thankyou views, and leads in parallel
    const [viewsResult, thankyouViewsResult, leadsResult] = await Promise.all([
      supabase
        .from('page_views')
        .select('view_date')
        .eq('funnel_page_id', funnelId)
        .eq('page_type', 'optin')
        .gte('view_date', startDate)
        .order('view_date'),
      supabase
        .from('page_views')
        .select('view_date')
        .eq('funnel_page_id', funnelId)
        .eq('page_type', 'thankyou')
        .gte('view_date', startDate)
        .order('view_date'),
      supabase
        .from('funnel_leads')
        .select('id, email, name, is_qualified, qualification_answers, utm_source, created_at')
        .eq('funnel_page_id', funnelId)
        .gte('created_at', `${startDate}T00:00:00Z`)
        .order('created_at'),
    ]);

    if (viewsResult.error) {
      logApiError('analytics/funnel/views', viewsResult.error, { userId: session.user.id, funnelId });
    }

    if (thankyouViewsResult.error) {
      logApiError('analytics/funnel/thankyou-views', thankyouViewsResult.error, { userId: session.user.id, funnelId });
    }

    if (leadsResult.error) {
      logApiError('analytics/funnel/leads', leadsResult.error, { userId: session.user.id, funnelId });
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

    const thankyouViews = thankyouViewsResult.data || [];

    // Aggregate thankyou views by day
    const thankyouViewsByDateMap = new Map<string, number>();
    for (const view of thankyouViews) {
      const date = view.view_date;
      thankyouViewsByDateMap.set(date, (thankyouViewsByDateMap.get(date) || 0) + 1);
    }

    const thankyouViewsByDay = dateRange.map((date) => ({
      date,
      views: thankyouViewsByDateMap.get(date) || 0,
    }));

    // Count leads who submitted qualification answers
    let totalResponded = 0;
    for (const lead of leads) {
      if (lead.qualification_answers) {
        totalResponded++;
      }
    }

    // Build lead table
    const leadsTable = leads.map((lead) => ({
      id: lead.id,
      email: lead.email,
      name: lead.name || null,
      isQualified: lead.is_qualified ?? null,
      utmSource: lead.utm_source || null,
      createdAt: lead.created_at,
    }));

    // Totals
    const totalViews = views.length;
    const totalLeads = leads.length;
    let totalQualified = 0;
    for (const lead of leads) {
      if (lead.is_qualified === true) {
        totalQualified++;
      }
    }

    const totalThankyouViews = thankyouViews.length;

    const totals = {
      views: totalViews,
      thankyouViews: totalThankyouViews,
      leads: totalLeads,
      qualified: totalQualified,
      responded: totalResponded,
      conversionRate: totalViews > 0 ? Math.round((totalLeads / totalViews) * 100) : 0,
      qualificationRate: totalLeads > 0 ? Math.round((totalQualified / totalLeads) * 100) : 0,
      responseRate: totalThankyouViews > 0 ? Math.round((totalResponded / totalThankyouViews) * 100) : 0,
    };

    return NextResponse.json({
      funnel: { id: funnel.id, title: funnel.optin_headline, slug: funnel.slug },
      viewsByDay,
      thankyouViewsByDay,
      leadsByDay,
      leads: leadsTable,
      totals,
    });
  } catch (error) {
    logApiError('analytics/funnel', error);
    return ApiErrors.internalError('Failed to fetch funnel analytics');
  }
}
