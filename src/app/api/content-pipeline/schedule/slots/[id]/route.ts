import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpSlotsService from '@/server/services/cp-schedule-slots.service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const result = await cpSlotsService.update(session.user.id, id, body);
    if (!result.success) {
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return ApiErrors.databaseError('Failed to update slot');
    }
    return NextResponse.json({ slot: result.slot });
  } catch (error) {
    logApiError('cp/schedule/slots', error);
    return ApiErrors.internalError('Failed to update slot');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await cpSlotsService.deleteSlot(session.user.id, id);
    if (!result.success) return ApiErrors.databaseError('Failed to delete slot');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('cp/schedule/slots', error);
    return ApiErrors.internalError('Failed to delete slot');
  }
}
