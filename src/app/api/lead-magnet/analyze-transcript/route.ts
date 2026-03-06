import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { transcript } = body;

    if (!transcript || typeof transcript !== 'string') {
      return ApiErrors.validationError('Transcript is required and must be a string');
    }
    if (transcript.length < 100) {
      return ApiErrors.validationError('Transcript too short. Please provide at least 100 characters.');
    }
    if (transcript.length > 50000) {
      return ApiErrors.validationError('Transcript too long. Maximum 50,000 characters.');
    }

    const result = await leadMagnetsService.analyzeTranscript(transcript);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
