import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpSlotsService from '@/server/services/cp-schedule-slots.service';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const result = await cpSlotsService.list(session.user.id);
    if (!result.success) return ApiErrors.databaseError('Failed to fetch slots');
    return NextResponse.json({ slots: result.slots });
  } catch (error) {
    logApiError('cp/schedule/slots', error);
    return ApiErrors.internalError('Failed to fetch slots');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { time_of_day, day_of_week, timezone } = body;
    const result = await cpSlotsService.create(session.user.id, {
      time_of_day,
      day_of_week,
      timezone,
    });
    if (!result.success) {
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return ApiErrors.databaseError('Failed to create slot');
    }
    return NextResponse.json({ slot: result.slot }, { status: 201 });
  } catch (error) {
    logApiError('cp/schedule/slots', error);
    return ApiErrors.internalError('Failed to create slot');
  }
}
