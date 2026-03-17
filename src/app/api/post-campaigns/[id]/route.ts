/**
 * /api/post-campaigns/[id] — get, update, and delete a single post campaign.
 * Auth required. All operations are scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';
import { getStatusCode } from '@/server/services/post-campaigns.service';
import { UpdatePostCampaignSchema, validateBody } from '@/lib/validations/api';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await service.getCampaign(session.user.id, id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    const { stats, ...campaign } = result.data;
    return NextResponse.json({ campaign, stats });
  } catch (error) {
    logError('api/post-campaigns/[id] GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const validation = validateBody(await request.json(), UpdatePostCampaignSchema);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

    const result = await service.updateCampaign(session.user.id, id, validation.data);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : result.error === 'validation' ? 400 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ campaign: result.data });
  } catch (error) {
    logError('api/post-campaigns/[id] PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await service.deleteCampaign(session.user.id, id);
    if (!result.success)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/post-campaigns/[id] DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
