/**
 * GET /api/outreach-campaigns — list campaigns (optional ?status= filter)
 * POST /api/outreach-campaigns — create campaign
 * Auth required. Never exposes other users' campaigns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/outreach-campaigns.service';
import { getStatusCode } from '@/server/services/outreach-campaigns.service';
import { CreateOutreachCampaignSchema } from '@/lib/validations/outreach-campaigns';
import { formatZodError } from '@/lib/validations/api';
import type { OutreachCampaignStatus } from '@/lib/types/outreach-campaigns';

const VALID_STATUSES: OutreachCampaignStatus[] = ['draft', 'active', 'paused', 'completed'];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    if (status && !VALID_STATUSES.includes(status as OutreachCampaignStatus)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const result = await service.listCampaigns(
      session.user.id,
      (status as OutreachCampaignStatus) ?? undefined
    );
    if (!result.success)
      return NextResponse.json(
        { error: result.message ?? 'Internal server error' },
        { status: 500 }
      );
    return NextResponse.json({ campaigns: result.data });
  } catch (error) {
    logError('api/outreach-campaigns GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const rawBody = await request.json();
    const parsed = CreateOutreachCampaignSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }
    const body = parsed.data;
    const result = await service.createCampaign(session.user.id, null, body);
    if (!result.success) {
      const status = result.error === 'validation' ? 400 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ campaign: result.data }, { status: 201 });
  } catch (error) {
    logError('api/outreach-campaigns POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
