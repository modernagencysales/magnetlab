/**
 * Content Pipeline — Schedule Week Route
 * POST /api/content-pipeline/posts/schedule-week
 *
 * Compound action: accepts an array of posts + an optional week_start date,
 * creates each post as a draft, and distributes them across the user's active
 * posting slots. Slots with no day_of_week set are skipped.
 *
 * Never contains business logic; delegates to postsService.scheduleWeek.
 */

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getDataScope } from '@/lib/utils/team-context';
import { logError } from '@/lib/utils/logger';
import { ScheduleWeekSchema, formatZodError } from '@/lib/validations/api';
import * as postsService from '@/server/services/posts.service';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const rawBody = await request.json();
    const parsed = ScheduleWeekSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json({ error: formatZodError(parsed.error) }, { status: 400 });
    }

    const { posts, week_start } = parsed.data;
    const scope = await getDataScope(session.user.id);

    const result = await postsService.scheduleWeek(scope, posts, week_start);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logError('cp/posts/schedule-week', error, { step: 'schedule_week_error' });
    const status = postsService.getStatusCode(error);
    const message = status < 500 ? (error as Error).message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
