// API Route: External Lead Magnet Content Extraction
// POST /api/external/lead-magnets/[id]/extract - Process extraction for a lead magnet
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { leadMagnetExtract } from '@/server/services/external.service';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';

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

    const { archetype, concept, answers } = body as { archetype?: LeadMagnetArchetype; concept?: LeadMagnetConcept; answers?: Record<string, string> };
    if (!archetype || !concept || !answers) return ApiErrors.validationError('Missing required fields: archetype, concept, answers');

    const result = await leadMagnetExtract(id, context.userId, archetype, concept, answers);
    if (!result.success) {
      if (result.error === 'not_found') return ApiErrors.notFound('Lead magnet');
      return ApiErrors.aiError('Failed to process extraction');
    }
    return NextResponse.json(result.data);
  } catch (error) {
    logApiError('external/lead-magnets/extract', error);
    return ApiErrors.aiError('Failed to process extraction');
  }
}

export const POST = withExternalAuth(async (request, context, body) => handlePost(request, context, body));
