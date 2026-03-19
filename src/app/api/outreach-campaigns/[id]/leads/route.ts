/**
 * /api/outreach-campaigns/[id]/leads — list and bulk-add leads.
 * GET — list leads (optional ?status= filter)
 * POST — bulk add leads (max 500)
 * Auth required. All operations are scoped to the authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as service from '@/server/services/outreach-campaigns.service';
import { getStatusCode } from '@/server/services/outreach-campaigns.service';
import type { OutreachLeadStatus, AddOutreachLeadInput } from '@/lib/types/outreach-campaigns';

const VALID_LEAD_STATUSES: OutreachLeadStatus[] = [
  'pending',
  'active',
  'completed',
  'replied',
  'withdrawn',
  'failed',
  'skipped',
];

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const status = request.nextUrl.searchParams.get('status');
    if (status && !VALID_LEAD_STATUSES.includes(status as OutreachLeadStatus)) {
      return NextResponse.json({ error: 'Invalid status filter' }, { status: 400 });
    }

    const result = await service.listLeads(
      session.user.id,
      id,
      (status as OutreachLeadStatus) ?? undefined
    );
    if (!result.success)
      return NextResponse.json(
        { error: result.message ?? 'Internal server error' },
        { status: 500 }
      );
    return NextResponse.json({ leads: result.data });
  } catch (error) {
    logError('api/outreach-campaigns/[id]/leads GET', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const body = (await request.json()) as { leads: AddOutreachLeadInput[] };
    if (!Array.isArray(body?.leads)) {
      return NextResponse.json({ error: 'leads must be an array' }, { status: 400 });
    }

    const result = await service.addLeads(session.user.id, id, body.leads);
    if (!result.success) {
      const status = result.error === 'validation' ? 400 : 500;
      return NextResponse.json({ error: result.message ?? 'Internal server error' }, { status });
    }
    return NextResponse.json({ inserted: result.data.inserted }, { status: 201 });
  } catch (error) {
    logError('api/outreach-campaigns/[id]/leads POST', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: getStatusCode(error) });
  }
}
