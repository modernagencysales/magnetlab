// API Route: External Quiz Generation
// POST /api/external/generate-quiz
//
// Generates qualification quiz questions using AI, creates a qualification form,
// inserts questions, and links the form to the funnel page.

import { NextResponse } from 'next/server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { authenticateExternalRequest } from '@/lib/api/external-auth';
import { generateQuiz } from '@/server/services/external.service';

export async function POST(request: Request) {
  try {
    if (!authenticateExternalRequest(request)) {
      return ApiErrors.unauthorized('Invalid or missing API key');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return ApiErrors.validationError('Invalid JSON in request body');
    }

    const {
      userId,
      funnelPageId,
      clientName,
      icpData,
      teamId,
      profileId,
    } = body as {
      userId?: string;
      funnelPageId?: string;
      clientName?: string;
      icpData?: Record<string, unknown>;
      teamId?: string;
      profileId?: string;
    };

    if (!userId || typeof userId !== 'string') {
      return ApiErrors.validationError('userId is required');
    }
    if (!funnelPageId || typeof funnelPageId !== 'string') {
      return ApiErrors.validationError('funnelPageId is required');
    }

    const result = await generateQuiz({
      userId,
      funnelPageId,
      clientName,
      icpData,
      teamId,
      profileId,
    });

    if (!result.success) {
      if (result.error === 'user_not_found') return ApiErrors.notFound('User');
      if (result.error === 'funnel_not_found') return ApiErrors.notFound('Funnel page');
      if (result.error === 'no_questions') return ApiErrors.aiError('Quiz generation produced no valid questions');
      return ApiErrors.databaseError('Failed to create or link quiz');
    }

    return NextResponse.json({
      success: true,
      formId: result.formId,
      questionCount: result.questionCount,
    });
  } catch (error) {
    logApiError('external/generate-quiz', error);
    return ApiErrors.internalError('An unexpected error occurred during quiz generation');
  }
}
