/**
 * POST /api/post-campaigns/[id]/pause — set a campaign status to paused.
 * Auth required. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await service.pauseCampaign(session.user.id, id);

    if (!result.success) {
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ campaign: result.data });
  } catch (error) {
    logError('api/post-campaigns/[id]/pause', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
