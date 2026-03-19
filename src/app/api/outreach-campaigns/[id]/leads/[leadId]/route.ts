/**
 * GET /api/outreach-campaigns/[id]/leads/[leadId] — individual lead detail.
 * Auth required. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/outreach-campaigns.service';
import { getStatusCode } from '@/server/services/outreach-campaigns.service';

type RouteParams = { params: Promise<{ id: string; leadId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { leadId } = await params;
    const result = await service.getLead(session.user.id, leadId);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ lead: result.data });
  } catch (error) {
    logError('api/outreach-campaigns/[id]/leads/[leadId] GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
