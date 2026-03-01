import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as signalsService from '@/server/services/signals.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await signalsService.getConfig(session.user.id);
    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    logError('api/signals/config', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const result = await signalsService.upsertConfig(session.user.id, {
      target_countries: body.target_countries,
      target_job_titles: body.target_job_titles,
      exclude_job_titles: body.exclude_job_titles,
      min_company_size: body.min_company_size,
      max_company_size: body.max_company_size,
      target_industries: body.target_industries,
      default_heyreach_campaign_id: body.default_heyreach_campaign_id,
      enrichment_enabled: body.enrichment_enabled,
      sentiment_scoring_enabled: body.sentiment_scoring_enabled,
      auto_push_enabled: body.auto_push_enabled,
    });

    if (!result.success) {
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
    return NextResponse.json({ config: result.config });
  } catch (error) {
    logError('api/signals/config', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
