/**
 * Content Pipeline — Creatives Route
 * GET  /api/content-pipeline/creatives — list creatives with optional filters
 * POST /api/content-pipeline/creatives — ingest a new creative and run AI analysis
 * Never contains business logic; delegates to creativesService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import { CreateCreativeSchema } from '@/lib/validations/exploits';
import { formatZodError } from '@/lib/validations/api';
import * as creativesService from '@/server/services/creatives.service';
import type { CreativeFilters } from '@/lib/types/exploits';

// ─── GET handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await getDataScope(session.user.id);
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status') ?? undefined;
    const source_platform = searchParams.get('source_platform') ?? undefined;
    const creative_type = searchParams.get('creative_type') ?? undefined;
    const min_score_param = searchParams.get('min_score');
    const limit_param = searchParams.get('limit');

    const min_score = min_score_param !== null ? Number(min_score_param) : undefined;
    const limit = limit_param !== null ? Number(limit_param) : undefined;

    const filters: CreativeFilters = {
      status: status as CreativeFilters['status'],
      source_platform: source_platform as CreativeFilters['source_platform'],
      creative_type: creative_type as CreativeFilters['creative_type'],
      min_score,
      limit,
    };

    const creatives = await creativesService.listCreatives(scope, filters);

    return NextResponse.json({ creatives });
  } catch (error) {
    logError('cp/creatives', error, { step: 'creatives_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST handler ────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = CreateCreativeSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const scope = await getDataScope(session.user.id);
    const creative = await creativesService.createCreative(scope, parsed.data);

    return NextResponse.json({ creative }, { status: 201 });
  } catch (error) {
    logError('cp/creatives', error, { step: 'creative_create_error' });
    return NextResponse.json(
      {
        error:
          creativesService.getStatusCode(error) < 500
            ? (error as Error).message
            : 'Internal server error',
      },
      { status: creativesService.getStatusCode(error) }
    );
  }
}
