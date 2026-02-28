// API Route: Activate Email Sequence
// POST /api/email-sequence/[leadMagnetId]/activate

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getPostHogServerClient } from '@/lib/posthog';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as emailSequenceService from '@/server/services/email-sequence.service';

interface RouteParams {
  params: Promise<{ leadMagnetId: string }>;
}

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { leadMagnetId } = await params;
    const result = await emailSequenceService.activate(session.user.id, leadMagnetId);

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Email sequence');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'Validation failed');
      if (result.error === 'database') return ApiErrors.databaseError(result.message ?? 'Failed to activate');
      return ApiErrors.internalError(result.message ?? 'Failed to activate');
    }

    if (result.posthogPayload) {
      try {
        getPostHogServerClient()?.capture({
          distinctId: session.user.id,
          event: 'email_sequence_activated',
          properties: result.posthogPayload,
        });
      } catch {
        // ignore
      }
    }

    return NextResponse.json({
      emailSequence: result.emailSequence,
      message: result.message,
    });
  } catch (error) {
    logApiError('email-sequence/activate', error);
    return ApiErrors.internalError('Failed to activate email sequence');
  }
}
