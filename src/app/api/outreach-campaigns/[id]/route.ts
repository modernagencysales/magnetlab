/**
 * /api/outreach-campaigns/[id] — get, update, and delete a single outreach campaign.
 * Auth required. All operations are scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/outreach-campaigns.service';
import { getStatusCode } from '@/server/services/outreach-campaigns.service';
import { UpdateOutreachCampaignSchema } from '@/lib/validations/outreach-campaigns';
import { formatZodError } from '@/lib/validations/api';

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
    const { stats, progress, ...campaign } = result.data;
    return NextResponse.json({ campaign, stats, progress });
  } catch (error) {
    logError('api/outreach-campaigns/[id] GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const rawBody = await request.json();
    const parsed = UpdateOutreachCampaignSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;
    const result = await service.updateCampaign(session.user.id, id, body);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : result.error === 'validation' ? 400 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ campaign: result.data });
  } catch (error) {
    logError('api/outreach-campaigns/[id] PATCH', error);
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
      return NextResponse.json(
        { error: result.message ?? 'Internal server error' },
        { status: 500 }
      );
    return NextResponse.json({ success: true });
  } catch (error) {
    logError('api/outreach-campaigns/[id] DELETE', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
