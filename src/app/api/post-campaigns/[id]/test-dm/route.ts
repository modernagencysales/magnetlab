/**
 * POST /api/post-campaigns/[id]/test-dm — preview rendered DM for a campaign.
 * Renders the DM template with test variables. No DM is sent.
 * Auth required. Scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { sendTestDm, getStatusCode } from '@/server/services/post-campaigns.service';

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const result = await sendTestDm(session.user.id, id);
    if (!result.success) {
      const status = result.error === 'not_found' ? 404 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json(result.data);
  } catch (error) {
    logError('api/post-campaigns/[id]/test-dm', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
