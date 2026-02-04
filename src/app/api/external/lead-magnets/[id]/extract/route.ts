// API Route: External Lead Magnet Content Extraction
// POST /api/external/lead-magnets/[id]/extract - Process extraction for a lead magnet
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { processContentExtraction } from '@/lib/ai/lead-magnet-generator';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetArchetype, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface ExtractRequestBody {
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

    const reqBody = body as ExtractRequestBody;
    const { archetype, concept, answers } = reqBody;

    if (!archetype || !concept || !answers) {
      return ApiErrors.validationError('Missing required fields: archetype, concept, answers');
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

    // Process content extraction
    const extractedContent = await processContentExtraction(archetype, concept, answers);

    // Update the lead magnet with extracted content
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({
        extracted_content: extractedContent,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', context.userId);

    if (updateError) {
      logApiError('external/lead-magnets/extract/update', updateError, { userId: context.userId, leadMagnetId: id });
      // Don't fail the request - just log it
    }

    return NextResponse.json(extractedContent);
  } catch (error) {
    logApiError('external/lead-magnets/extract', error);
    return ApiErrors.aiError('Failed to process extraction');
  }
}

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
