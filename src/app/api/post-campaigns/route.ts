/**
 * POST /api/post-campaigns — list and create post campaigns.
 * Auth required. Never exposes other users' campaigns.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/post-campaigns.service';
import { getStatusCode } from '@/server/services/post-campaigns.service';
import { CreatePostCampaignSchema, validateBody } from '@/lib/validations/api';
import type { PostCampaignStatus } from '@/lib/types/post-campaigns';

const VALID_STATUSES = ['draft', 'active', 'paused', 'completed'] as const;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const status = request.nextUrl.searchParams.get('status');
    if (status && !VALID_STATUSES.includes(status as (typeof VALID_STATUSES)[number])) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const result = await service.listCampaigns(
      session.user.id,
      (status as PostCampaignStatus) ?? undefined
    );
    if (!result.success)
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    return NextResponse.json({ campaigns: result.data });
  } catch (error) {
    logError('api/post-campaigns GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const validation = validateBody(await request.json(), CreatePostCampaignSchema);
    if (!validation.success) return NextResponse.json({ error: validation.error }, { status: 400 });

    const result = await service.createCampaign(session.user.id, null, validation.data);
    if (!result.success) {
      const status = result.error === 'validation' ? 400 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ campaign: result.data }, { status: 201 });
  } catch (error) {
    logError('api/post-campaigns POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
