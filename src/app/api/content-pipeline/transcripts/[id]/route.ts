import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTranscriptsService from '@/server/services/cp-transcripts.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await cpTranscriptsService.getById(session.user.id, id);
    if (!result.success) return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    return NextResponse.json({ transcript: result.transcript });
  } catch (error) {
    logApiError('cp/transcripts', error);
    return ApiErrors.internalError('Failed to fetch transcript');
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const body = await request.json();
    const result = await cpTranscriptsService.update(session.user.id, id, body);
    if (!result.success) {
      if (result.error === 'validation') return NextResponse.json({ error: result.message }, { status: 400 });
      return ApiErrors.databaseError('Failed to update transcript');
    }
    return NextResponse.json({ transcript: result.transcript });
  } catch (error) {
    logApiError('cp/transcripts', error);
    return ApiErrors.internalError('Failed to update transcript');
  }
}
