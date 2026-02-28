// API Route: Library Items
// GET /api/libraries/[id]/items - List items in library
// POST /api/libraries/[id]/items - Add item to library

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

    const { id: libraryId } = await params;
    if (!isValidUUID(libraryId)) {
      return ApiErrors.validationError('Invalid library ID');
    }

    const result = await librariesService.listItems(session.user.id, libraryId);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Library');
      return ApiErrors.databaseError('Failed to fetch library items');
    }

    return NextResponse.json({ items: result.items });
  } catch (error) {
    logApiError('libraries/items/list', error);
    return ApiErrors.internalError('Failed to fetch library items');
  }
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
    const { assetType, leadMagnetId, externalResourceId, iconOverride, sortOrder, isFeatured } = body;

    if (!assetType || !['lead_magnet', 'external_resource'].includes(assetType)) {
      return ApiErrors.validationError('assetType must be lead_magnet or external_resource');
    }
    if (assetType === 'lead_magnet' && !leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required for lead_magnet type');
    }
    if (assetType === 'external_resource' && !externalResourceId) {
      return ApiErrors.validationError('externalResourceId is required for external_resource type');
    }

    const result = await librariesService.addItem(session.user.id, libraryId, {
      assetType,
      leadMagnetId,
      externalResourceId,
      iconOverride,
      sortOrder,
      isFeatured,
    });

    if (!result.success) {
      if (result.error === 'not_found') {
        if (result.code === 'library') return ApiErrors.notFound('Library');
        if (result.code === 'lead_magnet') return ApiErrors.notFound('Lead magnet');
        return ApiErrors.notFound('External resource');
      }
      if (result.error === 'conflict') return ApiErrors.conflict(result.message ?? 'Item already in library');
      return ApiErrors.databaseError('Failed to add item to library');
    }

    return NextResponse.json({ item: result.item }, { status: 201 });
  } catch (error) {
    logApiError('libraries/items/add', error);
    return ApiErrors.internalError('Failed to add item to library');
  }
}
