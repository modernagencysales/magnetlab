// API Route: External Lead Magnet Content Generation
// POST /api/external/lead-magnets/[id]/generate - Generate content for a lead magnet
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { processContentExtraction } from '@/lib/ai/lead-magnet-generator';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface GenerateRequestBody {
  archetype: LeadMagnetArchetype;
  concept: LeadMagnetConcept;
  answers: Record<string, string>;
}

async function handlePost(
  request: NextRequest,
  context: ExternalAuthContext,
  body: unknown
): Promise<NextResponse> {
  try {
    // Extract ID from URL path
    const url = new URL(request.url);
    const pathParts = url.pathname.split('/');
    const idIndex = pathParts.indexOf('lead-magnets') + 1;
    const id = pathParts[idIndex];

    if (!id) {
      return ApiErrors.validationError('Lead magnet ID is required');
    }

    const reqBody = body as GenerateRequestBody;
    const { archetype, concept, answers } = reqBody;

    if (!archetype || !concept || !answers) {
      return ApiErrors.validationError('Missing required fields: archetype, concept, and answers');
    }

    const supabase = createSupabaseAdminClient();

    // Verify lead magnet ownership
    const { data: leadMagnet, error: lmError } = await supabase
      .from('lead_magnets')
      .select('id')
      .eq('id', id)
      .eq('user_id', context.userId)
      .single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Generate content
    const extractedContent = await processContentExtraction(archetype, concept, answers);

    // Update the lead magnet with generated content
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({
        extracted_content: extractedContent,
        status: 'content_ready',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', context.userId);

    if (updateError) {
      logApiError('external/lead-magnets/generate/update', updateError, { userId: context.userId, leadMagnetId: id });
      // Don't fail the request - just log it
    }

    return NextResponse.json(extractedContent);
  } catch (error) {
    logApiError('external/lead-magnets/generate', error);
    return ApiErrors.aiError('Failed to generate content');
  }
}

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
