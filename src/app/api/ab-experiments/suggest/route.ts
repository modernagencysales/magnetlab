// API Route: A/B Experiment Variant Suggestions
// POST /api/ab-experiments/suggest — AI-powered variant suggestions

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as abService from '@/server/services/ab-experiments.service';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { funnelPageId, testField } = body;

    if (!funnelPageId || !testField) {
      return ApiErrors.validationError('funnelPageId and testField are required');
    }
    if (!isValidUUID(funnelPageId)) return ApiErrors.validationError('Invalid funnelPageId');
    if (!abService.isValidTestField(testField)) {
      return ApiErrors.validationError(
        `testField must be one of: ${abService.VALID_TEST_FIELDS.join(', ')}`
      );
    }

    const result = await abService.suggestVariants(session.user.id, { funnelPageId, testField });
    return NextResponse.json(result);
  } catch (error) {
    const err = error as Error;
    if (err.message === 'NOT_FOUND') return ApiErrors.notFound('Funnel page');
    if (err.message?.includes('testField must be')) return ApiErrors.validationError(err.message);
    if (err.message === 'No text response from AI') return ApiErrors.aiError(err.message);
    logApiError('ab-experiments/suggest', error);
    return ApiErrors.internalError('Failed to generate suggestions');
  }
}
