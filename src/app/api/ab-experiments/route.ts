// API Route: A/B Experiments
// GET /api/ab-experiments?funnelPageId=xxx — list; POST /api/ab-experiments — create experiment + clone variant

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as abService from '@/server/services/ab-experiments.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { searchParams } = new URL(request.url);
    const funnelPageId = searchParams.get('funnelPageId') ?? undefined;
    if (funnelPageId && !isValidUUID(funnelPageId)) {
      return ApiErrors.validationError('Invalid funnelPageId');
    }

    const result = await abService.listExperiments(session.user.id, funnelPageId);
    return NextResponse.json(result);
  } catch (error) {
    logApiError('ab-experiments/list', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to fetch experiments');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const body = await request.json();
    const { funnelPageId, name, testField, variantValue, variantLabel } = body;

    if (!funnelPageId || !name || !testField) {
      return ApiErrors.validationError('funnelPageId, name, and testField are required');
    }
    if (!isValidUUID(funnelPageId)) return ApiErrors.validationError('Invalid funnelPageId');

    const result = await abService.createExperiment(session.user.id, {
      funnelPageId,
      name,
      testField,
      variantValue,
      variantLabel,
    });

    if (result.error === 'NOT_FOUND') return ApiErrors.notFound(result.message);
    if (result.error === 'CONFLICT') return ApiErrors.conflict(result.message);
    if (result.error === 'VALIDATION') return ApiErrors.validationError(result.message);

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('ab-experiments/create', error, { userId: (await auth())?.user?.id });
    return ApiErrors.internalError('Failed to create experiment');
  }
}
