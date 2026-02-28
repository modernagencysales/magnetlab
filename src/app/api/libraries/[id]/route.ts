// API Route: Single Library
// GET /api/libraries/[id] - Get library
// PUT /api/libraries/[id] - Update library
// DELETE /api/libraries/[id] - Delete library

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as librariesService from '@/server/services/libraries.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid library ID');
    }

    const result = await librariesService.getById(session.user.id, id);
    if (!result.success) {
      return ApiErrors.notFound('Library');
    }

    return NextResponse.json({ library: result.library, items: result.items });
  } catch (error) {
    logApiError('libraries/get', error);
    return ApiErrors.internalError('Failed to fetch library');
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid library ID');
    }

    const body = await request.json();
    const { name, description, icon, slug, autoFeatureDays } = body;

    const result = await librariesService.update(session.user.id, id, {
      name,
      description,
      icon,
      slug,
      autoFeatureDays,
    });

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Library');
      if (result.error === 'conflict') return ApiErrors.conflict(result.message ?? 'Slug already in use');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'No fields to update');
      return ApiErrors.databaseError('Failed to update library');
    }

    return NextResponse.json({ library: result.library });
  } catch (error) {
    logApiError('libraries/update', error);
    return ApiErrors.internalError('Failed to update library');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid library ID');
    }

    const result = await librariesService.deleteLibrary(session.user.id, id);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Library');
      return ApiErrors.databaseError('Failed to delete library');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('libraries/delete', error);
    return ApiErrors.internalError('Failed to delete library');
  }
}
