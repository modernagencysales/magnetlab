import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTranscriptsService from '@/server/services/cp-transcripts.service';

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    let teamId = request.nextUrl.searchParams.get('team_id');
    if (!teamId) {
      const cookieStore = await cookies();
      teamId = cookieStore.get('ml-team-context')?.value || null;
    }
    const speakerProfileId = request.nextUrl.searchParams.get('speaker_profile_id') || null;

    const result = await cpTranscriptsService.list(
      session.user.id,
      teamId,
      speakerProfileId,
      50
    );
    if (!result.success) return ApiErrors.databaseError('Failed to fetch transcripts');
    return NextResponse.json({ transcripts: result.transcripts });
  } catch (error) {
    logApiError('cp/transcripts', error);
    return ApiErrors.internalError('Failed to fetch transcripts');
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { transcript, title, speakerProfileId, source } = body;
    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 100) {
      return NextResponse.json(
        { error: 'Transcript is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    const result = await cpTranscriptsService.createFromPaste(session.user.id, {
      transcript,
      title,
      speakerProfileId,
      source,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to save transcript');
    return NextResponse.json({ success: true, transcript_id: result.transcript_id });
  } catch (error) {
    logApiError('cp/transcripts', error);
    return ApiErrors.internalError('Failed to save transcript');
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const id = request.nextUrl.searchParams.get('id');
    if (!id) return ApiErrors.validationError('Transcript id required');

    const result = await cpTranscriptsService.deleteTranscript(session.user.id, id);
    if (!result.success) return ApiErrors.databaseError('Failed to delete transcript');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('cp/transcripts', error);
    return ApiErrors.internalError('Failed to delete transcript');
  }
}
