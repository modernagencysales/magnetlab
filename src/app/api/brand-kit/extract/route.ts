// API Route: Extract Business Context from unstructured content
// POST /api/brand-kit/extract

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { extractBusinessContext } from '@/lib/ai';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { ContentType } from '@/lib/types/lead-magnet';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();

    // Validate required fields
    if (!body.content || typeof body.content !== 'string') {
      return ApiErrors.validationError('content is required and must be a string');
    }

    if (body.content.trim().length < 50) {
      return ApiErrors.validationError('Content is too short for meaningful extraction. Please provide more text (at least 50 characters).');
    }

    // Validate contentType if provided
    const validContentTypes: ContentType[] = ['offer-doc', 'linkedin', 'sales-page', 'other'];
    const contentType: ContentType | undefined =
      body.contentType && validContentTypes.includes(body.contentType)
        ? body.contentType
        : undefined;

    const result = await extractBusinessContext(body.content, contentType);

    return NextResponse.json(result);
  } catch (error) {
    logApiError('brand-kit/extract', error);
    return ApiErrors.aiError(error instanceof Error ? error.message : 'Failed to extract business context');
  }
}
