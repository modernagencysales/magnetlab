import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors } from '@/lib/api/errors';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { content } = body;

    if (!content || typeof content !== 'string') {
      return ApiErrors.validationError('Content is required and must be a string');
    }
    if (content.length < 50) {
      return ApiErrors.validationError('Content too short. Please provide at least 50 characters.');
    }
    if (content.length > 20000) {
      return ApiErrors.validationError('Content too long. Maximum 20,000 characters.');
    }

    const result = await leadMagnetsService.analyzeCompetitor(session.user.id, content);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
  }
}
