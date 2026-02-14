// API Route: Email Analytics
// GET /api/analytics/email?range=7d|30d|90d
// Returns email event totals, rates, and per-lead-magnet breakdown

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';

const VALID_RANGES = ['7d', '30d', '90d'] as const;
type Range = (typeof VALID_RANGES)[number];

function parseDays(range: Range): number {
  return parseInt(range.replace('d', ''), 10);
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
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    const startIso = startDate.toISOString();

    const supabase = createSupabaseAdminClient();
    const userId = session.user.id;

    // Fetch all email events for this user within range
    const { data: events, error: eventsError } = await supabase
      .from('email_events')
      .select('event_type, lead_magnet_id')
      .eq('user_id', userId)
      .gte('created_at', startIso);

    if (eventsError) {
      logApiError('analytics/email/events', eventsError, { userId });
      return ApiErrors.databaseError('Failed to fetch email events');
    }

    const allEvents = events || [];

    // Aggregate totals by event type
    let sent = 0;
    let delivered = 0;
    let opened = 0;
    let clicked = 0;
    let bounced = 0;

    // Per-magnet aggregation
    const magnetStats: Record<string, { sent: number; opened: number; clicked: number }> = {};

    for (const event of allEvents) {
      const type = event.event_type as string;
      const lmId = event.lead_magnet_id as string | null;

      switch (type) {
        case 'sent':
          sent++;
          if (lmId) {
            if (!magnetStats[lmId]) magnetStats[lmId] = { sent: 0, opened: 0, clicked: 0 };
            magnetStats[lmId].sent++;
          }
          break;
        case 'delivered':
          delivered++;
          break;
        case 'opened':
          opened++;
          if (lmId) {
            if (!magnetStats[lmId]) magnetStats[lmId] = { sent: 0, opened: 0, clicked: 0 };
            magnetStats[lmId].opened++;
          }
          break;
        case 'clicked':
          clicked++;
          if (lmId) {
            if (!magnetStats[lmId]) magnetStats[lmId] = { sent: 0, opened: 0, clicked: 0 };
            magnetStats[lmId].clicked++;
          }
          break;
        case 'bounced':
          bounced++;
          break;
      }
    }

    const totals = { sent, delivered, opened, clicked, bounced };

    // Calculate rates (avoid division by zero)
    const rates = {
      deliveryRate: sent > 0 ? Math.round((delivered / sent) * 1000) / 10 : 0,
      openRate: delivered > 0 ? Math.round((opened / delivered) * 1000) / 10 : 0,
      clickRate: delivered > 0 ? Math.round((clicked / delivered) * 1000) / 10 : 0,
      bounceRate: sent > 0 ? Math.round((bounced / sent) * 1000) / 10 : 0,
    };

    // Fetch lead magnet titles for the magnets in our stats
    const magnetIds = Object.keys(magnetStats);
    let byMagnet: Array<{
      leadMagnetId: string;
      title: string;
      sent: number;
      opened: number;
      clicked: number;
    }> = [];

    if (magnetIds.length > 0) {
      const { data: magnets, error: magnetsError } = await supabase
        .from('lead_magnets')
        .select('id, title')
        .in('id', magnetIds);

      if (magnetsError) {
        logApiError('analytics/email/magnets', magnetsError, { userId });
        // Continue without titles
      }

      const titleMap: Record<string, string> = {};
      if (magnets) {
        for (const m of magnets) {
          titleMap[m.id] = m.title || 'Untitled';
        }
      }

      byMagnet = magnetIds
        .map((id) => ({
          leadMagnetId: id,
          title: titleMap[id] || 'Untitled',
          ...magnetStats[id],
        }))
        .sort((a, b) => b.sent - a.sent);
    }

    return NextResponse.json({ totals, rates, byMagnet });
  } catch (error) {
    logApiError('analytics/email', error);
    return ApiErrors.internalError('Failed to fetch email analytics');
  }
}
