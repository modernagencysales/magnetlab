// API Route: External Generate Lead Magnet Ideas
// POST /api/external/lead-magnets/ideate
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { generateLeadMagnetIdeas } from '@/lib/ai/lead-magnet-generator';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { BusinessContext, CallTranscriptInsights, CompetitorAnalysis } from '@/lib/types/lead-magnet';

interface IdeateRequestBody extends BusinessContext {
  sources?: {
    callTranscriptInsights?: CallTranscriptInsights;
    competitorAnalysis?: CompetitorAnalysis;
  };
}

async function handlePost(
  _request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    const reqBody = body as IdeateRequestBody;
    const { sources, ...businessContext } = reqBody;

    // Validate required fields
    if (!businessContext.businessDescription || !businessContext.businessType) {
      return ApiErrors.validationError('Missing required fields: businessDescription and businessType');
    }

    // Check usage limits
    const supabase = createSupabaseAdminClient();
    try {
      const { data: canCreate, error: rpcError } = await supabase.rpc('check_usage_limit', {
        p_user_id: context.userId,
        p_limit_type: 'lead_magnets',
      });

      if (rpcError) {
        logApiError('external/lead-magnets/ideate/usage-check', rpcError, { userId: context.userId });
      } else if (canCreate === false) {
        return ApiErrors.usageLimitExceeded('Monthly lead magnet limit reached. Upgrade your plan for more.');
      }
    } catch (err) {
      logApiError('external/lead-magnets/ideate/usage-check', err, { userId: context.userId, note: 'RPC unavailable' });
    }

    // Generate ideas using AI
    const result = await generateLeadMagnetIdeas(businessContext, sources);

    // Save ideation result to brand_kit for future use
    try {
      await supabase
        .from('brand_kits')
        .update({
          saved_ideation_result: result,
          ideation_generated_at: new Date().toISOString(),
        })
        .eq('user_id', context.userId);
    } catch (saveError) {
      logApiError('external/lead-magnets/ideate/save', saveError, { userId: context.userId, note: 'Non-critical' });
      // Continue anyway - saving is not critical
    }

    return NextResponse.json(result);
  } catch (error) {
    logApiError('external/lead-magnets/ideate', error);
    return ApiErrors.aiError('Failed to generate ideas');
  }
}

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
