// API Route: Single Library Item
// PUT /api/libraries/[id]/items/[itemId] - Update item
// DELETE /api/libraries/[id]/items/[itemId] - Remove item

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as librariesService from '@/server/services/libraries.service';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: libraryId, itemId } = await params;
    if (!isValidUUID(libraryId) || !isValidUUID(itemId)) {
      return ApiErrors.validationError('Invalid ID format');
    }

    const body = await request.json();
    const { iconOverride, sortOrder, isFeatured } = body;

    const result = await librariesService.updateItem(session.user.id, libraryId, itemId, {
      iconOverride,
      sortOrder,
      isFeatured,
    });

    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Library item');
      if (result.error === 'validation') return ApiErrors.validationError(result.message ?? 'No fields to update');
      return ApiErrors.databaseError('Failed to update library item');
    }

    return NextResponse.json({ item: result.item });
  } catch (error) {
    logApiError('libraries/items/update', error);
    return ApiErrors.internalError('Failed to update library item');
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: libraryId, itemId } = await params;
    if (!isValidUUID(libraryId) || !isValidUUID(itemId)) {
      return ApiErrors.validationError('Invalid ID format');
    }

    const result = await librariesService.deleteItem(session.user.id, libraryId, itemId);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Library item');
      return ApiErrors.databaseError('Failed to remove item from library');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('libraries/items/delete', error);
    return ApiErrors.internalError('Failed to remove item from library');
  }
}
