import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { logError } from '@/lib/utils/logger';
import * as cpTeamScheduleService from '@/server/services/cp-team-schedule.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const teamId = searchParams.get('team_id');

    if (!teamId) {
      return NextResponse.json({ error: 'team_id is required' }, { status: 400 });
    }

    const weekStartParam = searchParams.get('week_start') ?? null;

    const result = await cpTeamScheduleService.getTeamSchedule(
      teamId,
      session.user.id,
      weekStartParam
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result.data);
  } catch (error) {
    logError('cp/team-schedule', error, { step: 'team_schedule_fetch_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
