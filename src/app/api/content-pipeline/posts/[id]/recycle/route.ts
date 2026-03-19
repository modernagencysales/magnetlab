/**
 * Content Pipeline — Recycle Post Route
 * POST /api/content-pipeline/posts/:id/recycle
 * Creates a repost or cousin from a recyclable post.
 * Never contains business logic; delegates to recyclingService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as recyclingService from '@/server/services/recycling.service';

// ─── Validation ───────────────────────────────────────────────────────────────

const RecyclePostSchema = z.object({
  type: z.enum(['repost', 'cousin']),
});

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const rawBody = await request.json();
    const parsed = RecyclePostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors.map((e) => e.message).join(', ') },
        { status: 400 }
      );
    }

    const { type } = parsed.data;

    const post =
      type === 'repost'
        ? await recyclingService.createRepost(session.user.id, id)
        : await recyclingService.createCousin(session.user.id, id);

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    logError('cp/posts/recycle', error, { step: 'recycle_post_error' });
    return NextResponse.json(
      {
        error:
          recyclingService.getStatusCode(error) < 500
            ? (error as Error).message
            : 'Internal server error',
      },
      { status: recyclingService.getStatusCode(error) }
    );
  }
}
