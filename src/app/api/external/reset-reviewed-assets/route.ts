/**
 * External API — Reset Reviewed Assets.
 * POST /api/external/reset-reviewed-assets
 * Called by gtm-api when a client requests revisions on their assets.
 * Uses shared external auth utility (Bearer token, timing-safe).
 */

import { NextRequest, NextResponse } from 'next/server';
import { logError } from '@/lib/utils/logger';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { ResetEditedPostsSchema } from '@/lib/validations/content-queue';
import { formatZodError } from '@/lib/validations/api';
import * as contentQueueService from '@/server/services/content-queue.service';

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    if (!authenticateExternalRequest(request)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = ResetEditedPostsSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const result = await contentQueueService.resetReviewedAssets(parsed.data.userId);
    return NextResponse.json(result);
  } catch (error) {
    logError('external/reset-reviewed-assets', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
