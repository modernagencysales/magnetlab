import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as cpTeamScheduleService from '@/server/services/cp-team-schedule.service';

const assignSchema = z.object({
  post_id: z.string().uuid(),
  scheduled_time: z.string().datetime(),
  team_profile_id: z.string().uuid().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = assignSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const { post_id, scheduled_time, team_profile_id } = parsed.data;

    const result = await cpTeamScheduleService.assignPost(
      session.user.id,
      post_id,
      scheduled_time,
      team_profile_id
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/team-schedule/assign', error, { step: 'assign_post_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
