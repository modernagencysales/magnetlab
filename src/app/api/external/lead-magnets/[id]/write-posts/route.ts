// API Route: External Lead Magnet Write LinkedIn Posts
// POST /api/external/lead-magnets/[id]/write-posts - Generate LinkedIn post variations
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { leadMagnetWritePosts } from '@/server/services/external.service';
import type { PostWriterInput } from '@/lib/types/lead-magnet';

async function handlePost(
  request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idIndex = pathParts.indexOf('lead-magnets') + 1;
    const id = pathParts[idIndex];
    if (!id) return ApiErrors.validationError('Lead magnet ID is required');

    const input = body as PostWriterInput;
    if (!input.leadMagnetTitle || !input.contents || !input.problemSolved) {
      return ApiErrors.validationError('Missing required fields: leadMagnetTitle, contents, problemSolved');
    }

    const result = await leadMagnetWritePosts(id, context.userId, input);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Lead magnet');
      return ApiErrors.aiError('Failed to generate post variations');
    }
    return NextResponse.json(result.data);
  } catch (error) {
    logApiError('external/lead-magnets/write-posts', error);
    return ApiErrors.aiError('Failed to generate post variations');
  }
}

export const POST = withExternalAuth(async (request, context, body) => handlePost(request, context, body));
