// API Route: External Generate Lead Magnet Ideas
// POST /api/external/lead-magnets/ideate
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { leadMagnetIdeate } from '@/server/services/external.service';
import type { BusinessContext, CallTranscriptInsights, CompetitorAnalysis } from '@/lib/types/lead-magnet';

async function handlePost(
  _request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const reqBody = body as BusinessContext & { sources?: { callTranscriptInsights?: CallTranscriptInsights; competitorAnalysis?: CompetitorAnalysis } };
    const { sources, ...businessContext } = reqBody;

    if (!businessContext.businessDescription || !businessContext.businessType) {
      return ApiErrors.validationError('Missing required fields: businessDescription and businessType');
    }

    const result = await leadMagnetIdeate(context.userId, businessContext, sources);
    if (!result.success) {
      if (result.error === 'usage_limit') return ApiErrors.usageLimitExceeded('Monthly lead magnet limit reached. Upgrade your plan for more.');
      return ApiErrors.aiError('Failed to generate ideas');
    }
    return NextResponse.json(result.data);
  } catch (error) {
    logApiError('external/lead-magnets/ideate', error);
    return ApiErrors.aiError('Failed to generate ideas');
  }
}

export const POST = withExternalAuth(async (request, context, body) => handlePost(request, context, body));
