// API Route: Reorder Library Items
// POST /api/libraries/[id]/items/reorder - Batch update sort orders

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import * as librariesService from '@/server/services/libraries.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id: libraryId } = await params;
    if (!isValidUUID(libraryId)) {
      return ApiErrors.validationError('Invalid library ID');
    }

    const body = await request.json();
    const { items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return ApiErrors.validationError('items array is required');
    }
    for (const item of items) {
      if (!item.id || typeof item.id !== 'string' || !isValidUUID(item.id)) {
        return ApiErrors.validationError('Each item must have a valid id');
      }
      if (typeof item.sortOrder !== 'number' || item.sortOrder < 0) {
        return ApiErrors.validationError('Each item must have a valid sortOrder');
      }
    }

    const result = await librariesService.reorderItems(session.user.id, libraryId, items);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Library');
      return ApiErrors.databaseError('Failed to reorder some items');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('libraries/items/reorder', error);
    return ApiErrors.internalError('Failed to reorder items');
  }
}
