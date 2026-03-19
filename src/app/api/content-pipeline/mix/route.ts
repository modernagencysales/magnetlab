/**
 * Content Pipeline — Mix Route
 * POST /api/content-pipeline/mix
 * Accepts a combination of ingredient IDs, calls Claude to generate content,
 * persists the recipe, and returns drafts or ideas.
 * Never contains business logic; delegates to mixer.service.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { MixSchema } from '@/lib/validations/mixer';
import { formatZodError } from '@/lib/validations/api';
import * as mixerService from '@/server/services/mixer.service';

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = MixSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await mixerService.mix(parsed.data);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logError('cp/mix', error, { step: 'mix_error' });
    const status = mixerService.getStatusCode(error);
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
