import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import type { SignalType } from '@/lib/types/signals';
import * as signalsService from '@/server/services/signals.service';

const MAX_LEADS_BULK = 200;

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') ?? undefined;
    const icpMatch = searchParams.get('icp_match') ?? undefined;
    const signalType = searchParams.get('signal_type') as SignalType | null ?? null;
    const minScore = searchParams.get('min_score') ?? undefined;
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const result = await signalsService.listLeads(
      session.user.id,
      { status, icpMatch, signalType, minScore },
      page,
      limit
    );

    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({
      leads: result.leads,
      total: result.total,
      page: result.page,
      limit: result.limit,
    });
  } catch (error) {
    logError('api/signals/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { action, lead_ids, campaign_id } = body as {
      action?: string;
      lead_ids?: string[];
      campaign_id?: string;
    };

    if (!action || !Array.isArray(lead_ids) || lead_ids.length === 0) {
      return NextResponse.json(
        { error: 'action and lead_ids[] are required' },
        { status: 400 }
      );
    }

    if (lead_ids.length > MAX_LEADS_BULK) {
      return NextResponse.json(
        { error: 'Maximum 200 leads per bulk action' },
        { status: 400 }
      );
    }

    if (action === 'exclude') {
      const result = await signalsService.bulkExcludeLeads(session.user.id, lead_ids);
      if (!result.success) {
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
      }
      return NextResponse.json({ success: true, excluded: result.excluded });
    }

    if (action === 'push') {
      if (!campaign_id) {
        return NextResponse.json(
          { error: 'campaign_id is required for push action' },
          { status: 400 }
        );
      }
      const result = await signalsService.bulkPushLeads(session.user.id, lead_ids, campaign_id);
      if (!result.success) {
        if (result.error === 'not_found') {
          return NextResponse.json({ error: result.message }, { status: 404 });
        }
        return NextResponse.json(
          { success: false, added: result.added, error: result.error },
          { status: 502 }
        );
      }
      return NextResponse.json({ success: true, added: result.added });
    }

    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    );
  } catch (error) {
    logError('api/signals/leads', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
