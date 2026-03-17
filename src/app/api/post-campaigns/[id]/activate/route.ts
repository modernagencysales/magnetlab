/**
 * POST /api/post-campaigns/[id]/activate — set a campaign status to active.
 * Auth required. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { activateCampaign, getStatusCode } from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await activateCampaign(session.user.id, id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ campaign: result.data });
  } catch (error) {
    logError('api/post-campaigns/[id]/activate', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
