/**
 * POST /api/outreach-campaigns/[id]/activate — activate campaign (validates prerequisites).
 * Requires at least one lead and a first_message_template. Auth required.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/outreach-campaigns.service';
import { getStatusCode } from '@/server/services/outreach-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await service.activateCampaign(session.user.id, id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : result.error === 'validation' ? 400 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ campaign: result.data });
  } catch (error) {
    logError('api/outreach-campaigns/[id]/activate POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
