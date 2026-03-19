/**
 * GET /api/linkedin-activity — unified LinkedIn activity stream.
 * Query params: account_id, action_type, since (ISO date), source_campaign_id, limit, offset.
 * Auth required. Returns entries scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as queueRepo from '@/server/repositories/linkedin-action-queue.repo';

const DEFAULT_LIMIT = 50;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const limit = Math.min(parseInt(sp.get('limit') ?? String(DEFAULT_LIMIT), 10), 200);
    const offset = parseInt(sp.get('offset') ?? '0', 10);

    const { data, error } = await queueRepo.listActivityLog({
      accountId: sp.get('account_id') ?? undefined,
      actionType: sp.get('action_type') ?? undefined,
      since: sp.get('since') ?? undefined,
      sourceCampaignId: sp.get('source_campaign_id') ?? undefined,
      limit: isNaN(limit) ? DEFAULT_LIMIT : limit,
      offset: isNaN(offset) ? 0 : offset,
    });

    if (error) {
      logError('api/linkedin-activity GET', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ activity: data ?? [] });
  } catch (error) {
    logError('api/linkedin-activity GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
