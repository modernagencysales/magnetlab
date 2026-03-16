/**
 * /api/post-campaigns/[id] — get, update, and delete a single post campaign.
 * Auth required. All operations are scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await service.getCampaign(session.user.id, id);

    if (!result.success) {
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    const { stats, ...campaign } = result.data;
    return NextResponse.json({ campaign, stats });
  } catch (error) {
    logError('api/post-campaigns/[id] GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const result = await service.updateCampaign(session.user.id, id, body);

    if (!result.success) {
      if (result.error === 'validation') {
        return NextResponse.json({ error: result.message }, { status: 400 });
      }
      if (result.error === 'not_found') {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ campaign: result.data });
  } catch (error) {
    logError('api/post-campaigns/[id] PATCH', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const result = await service.deleteCampaign(session.user.id, id);

    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/post-campaigns/[id] DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
