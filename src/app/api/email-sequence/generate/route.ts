// API Route: Generate Email Sequence
// POST /api/email-sequence/generate - Generate 5-email welcome sequence

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { checkResourceLimit } from '@/lib/auth/plan-limits';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as emailSequenceService from '@/server/services/email-sequence.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const limitCheck = await checkResourceLimit(session.user.id, 'email_sequences');
    if (!limitCheck.allowed) {
      return NextResponse.json(
        {
          error: 'Plan limit reached',
          current: limitCheck.current,
          limit: limitCheck.limit,
          upgrade: '/settings#billing',
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { leadMagnetId, useAI = true } = body;

    if (!leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required');
    }

    const result = await emailSequenceService.generate(leadMagnetId, useAI, session.user.id);

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Lead magnet');
      if (result.error === 'database') return ApiErrors.databaseError(result.message ?? 'Failed to save');
      return ApiErrors.internalError(result.message ?? 'Failed to generate');
    }

    return NextResponse.json({
      emailSequence: result.emailSequence,
      generated: result.generated,
    });
  } catch (error) {
    logApiError('email-sequence/generate', error);
    return ApiErrors.internalError('Failed to generate email sequence');
  }
}
