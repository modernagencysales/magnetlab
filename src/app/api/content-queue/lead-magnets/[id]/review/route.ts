/**
 * Content Queue — Lead Magnet Review Route.
 * PATCH /api/content-queue/lead-magnets/[id]/review
 * Marks a lead magnet as reviewed (or un-reviewed) in the content queue.
 * Never contains business logic; delegates to contentQueueService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import { ReviewAssetSchema } from '@/lib/validations/content-queue';
import { formatZodError } from '@/lib/validations/api';
import * as contentQueueService from '@/server/services/content-queue.service';

// ─── PATCH handler ─────────────────────────────────────────────────────────

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const rawBody = await request.json();
    const parsed = ReviewAssetSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    await contentQueueService.reviewLeadMagnet(session.user.id, id, parsed.data.reviewed);
    return NextResponse.json({ success: true });
  } catch (error) {
    const status = contentQueueService.getStatusCode(error);
    logError('content-queue/review-lm', error, { step: 'review_lead_magnet_error' });
    return NextResponse.json(
      { error: status < 500 ? (error as Error).message : 'Internal server error' },
      { status }
    );
  }
}
