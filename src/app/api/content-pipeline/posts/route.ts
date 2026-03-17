/**
 * Content Pipeline — Posts Route
 * GET  /api/content-pipeline/posts  — list posts with optional filters
 * POST /api/content-pipeline/posts  — create an agent-authored draft post
 *
 * Never contains business logic; delegates to postsService.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import { CreateAgentPostSchema, formatZodError } from '@/lib/validations/api';
import * as postsService from '@/server/services/posts.service';

// ─── GET handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const scope = await getDataScope(session.user.id);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') ?? undefined;
    const isBufferParam = searchParams.get('is_buffer');
    const teamProfileId = searchParams.get('team_profile_id') ?? undefined;
    const parsed = parseInt(searchParams.get('limit') || '50', 10);
    const limit = Math.min(Number.isNaN(parsed) ? 50 : parsed, 200);

    const isBuffer =
      isBufferParam === 'true' ? true : isBufferParam === 'false' ? false : undefined;

    const posts = await postsService.getPosts(scope, {
      status,
      isBuffer,
      teamProfileId,
      limit,
    });

    return NextResponse.json({ posts });
  } catch (error) {
    logError('cp/posts', error, { step: 'posts_list_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST handler ──────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = CreateAgentPostSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const { body, title, pillar, content_type } = parsed.data;
    const scope = await getDataScope(session.user.id);

    const post = await postsService.createAgentPost(scope, {
      body,
      title,
      pillar,
      content_type,
    });

    return NextResponse.json({ post }, { status: 201 });
  } catch (error) {
    logError('cp/posts', error, { step: 'post_create_error' });
    return NextResponse.json(
      {
        error:
          postsService.getStatusCode(error) < 500
            ? (error as Error).message
            : 'Internal server error',
      },
      { status: postsService.getStatusCode(error) }
    );
  }
}
