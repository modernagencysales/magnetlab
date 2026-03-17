/**
 * GET /api/post-campaigns/[id]/leads — list leads for a post campaign.
 * Auth required. Optional ?status= filter. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { listCampaignLeads, getStatusCode } from '@/server/services/post-campaigns.service';
import type { PostCampaignLeadStatus } from '@/lib/types/post-campaigns';

type RouteParams = { params: Promise<{ id: string }> };

const VALID_LEAD_STATUSES = [
  'detected',
  'connection_pending',
  'connection_accepted',
  'dm_queued',
  'dm_sent',
  'dm_failed',
  'skipped',
] as const;

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const status = request.nextUrl.searchParams.get('status');
    if (status && !VALID_LEAD_STATUSES.includes(status as (typeof VALID_LEAD_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const result = await listCampaignLeads(
      session.user.id,
      id,
      (status as PostCampaignLeadStatus) ?? undefined
    );
    if (!result.success)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return NextResponse.json({ leads: result.data });
  } catch (error) {
    logError('api/post-campaigns/[id]/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
