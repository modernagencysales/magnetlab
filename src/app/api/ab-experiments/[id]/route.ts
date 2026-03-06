// API Route: A/B Experiment Detail
// GET /api/ab-experiments/[id] — get with variant stats; PATCH — pause/resume/declare winner; DELETE — delete

import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as abService from '@/server/services/ab-experiments.service';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid experiment ID');

    const result = await abService.getExperimentById(id, session.user.id);
    if (!result) return ApiErrors.notFound('Experiment');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('ab-experiments/get', error);
    return ApiErrors.internalError('Failed to fetch experiment');
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
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid experiment ID');

    const body = await request.json();
    const { action, winnerId } = body;
    if (!action) return ApiErrors.validationError('action is required');

    const result = await abService.patchExperiment(id, session.user.id, { action, winnerId });
    if (!result) return ApiErrors.notFound('Experiment');
    if ('error' in result) {
      return ApiErrors.validationError(result.message ?? 'Validation failed');
    }
    return NextResponse.json(result);
  } catch (error) {
    logApiError('ab-experiments/patch', error);
    return ApiErrors.internalError('Failed to update experiment');
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    if (!isValidUUID(id)) return ApiErrors.validationError('Invalid experiment ID');

    const result = await abService.deleteExperiment(id, session.user.id);
    if (!result) return ApiErrors.notFound('Experiment');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('ab-experiments/delete', error);
    return ApiErrors.internalError('Failed to delete experiment');
  }
}
