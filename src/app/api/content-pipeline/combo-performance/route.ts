/**
 * Content Pipeline — Combo Performance Route
 * GET /api/content-pipeline/combo-performance
 * Returns top N ingredient combos sorted by engagement multiplier for a team profile.
 * Never contains business logic; delegates to mixer.service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { ComboPerformanceQuerySchema } from '@/lib/validations/mixer';
import { formatZodError } from '@/lib/validations/api';
import * as mixerService from '@/server/services/mixer.service';

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const parsed = ComboPerformanceQuerySchema.safeParse({
      team_profile_id: searchParams.get('team_profile_id'),
      limit: searchParams.get('limit') ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const combos = await mixerService.getComboPerformance(
      parsed.data.team_profile_id,
      parsed.data.limit
    );
    return NextResponse.json({ combos });
  } catch (error) {
    logError('cp/combo-performance', error, { step: 'combo_performance_error' });
    const status = mixerService.getStatusCode(error);
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
