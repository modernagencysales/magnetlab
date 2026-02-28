// API Route: Libraries List and Create
// GET /api/libraries - List all libraries
// POST /api/libraries - Create new library

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as librariesService from '@/server/services/libraries.service';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await librariesService.list(session.user.id, limit, offset);
    if (!result.success) {
      return ApiErrors.databaseError('Failed to fetch libraries');
    }

    const response = NextResponse.json({ libraries: result.libraries });
    response.headers.set('Cache-Control', 'private, max-age=60, stale-while-revalidate=120');
    return response;
  } catch (error) {
    logApiError('libraries/list', error);
    return ApiErrors.internalError('Failed to fetch libraries');
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { name, description, icon, slug: requestedSlug, autoFeatureDays } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return ApiErrors.validationError('name is required');
    }

    const result = await librariesService.create(session.user.id, {
      name,
      description,
      icon,
      slug: requestedSlug,
      autoFeatureDays,
    });

    if (!result.success) {
      if (result.error === 'conflict') return ApiErrors.conflict(result.message ?? 'Conflict');
      return ApiErrors.databaseError('Failed to create library');
    }

    return NextResponse.json({ library: result.library }, { status: 201 });
  } catch (error) {
    logApiError('libraries/create', error);
    return ApiErrors.internalError('Failed to create library');
  }
}
