/**
 * GET /api/post-campaigns/[id]/leads — list leads for a post campaign.
 * Auth required. Optional ?status= filter. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';
import type { PostCampaignLeadStatus } from '@/lib/types/post-campaigns';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const status = request.nextUrl.searchParams.get('status') as PostCampaignLeadStatus | null;
    const result = await service.listCampaignLeads(session.user.id, id, status ?? undefined);

    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ leads: result.data });
  } catch (error) {
    logError('api/post-campaigns/[id]/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
