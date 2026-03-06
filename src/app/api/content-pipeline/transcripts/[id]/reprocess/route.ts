import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTranscriptsService from '@/server/services/cp-transcripts.service';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const result = await cpTranscriptsService.reprocess(session.user.id, id);
    if (!result.success) {
      if (result.error === 'not_found') return NextResponse.json({ error: result.message }, { status: 404 });
      if (result.error === 'conflict') return NextResponse.json({ error: result.message }, { status: 409 });
      return ApiErrors.internalError(result.message ?? 'Failed to reprocess');
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('cp/transcripts/reprocess', error);
    return ApiErrors.internalError('Failed to reprocess transcript');
  }
}
