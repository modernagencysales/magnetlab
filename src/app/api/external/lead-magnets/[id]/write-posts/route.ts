// API Route: External Lead Magnet Write LinkedIn Posts
// POST /api/external/lead-magnets/[id]/write-posts - Generate LinkedIn post variations
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { generatePostVariations } from '@/lib/ai/lead-magnet-generator';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { PostWriterInput } from '@/lib/types/lead-magnet';

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

    const input = body as PostWriterInput;

    // Validate required fields
    if (!input.leadMagnetTitle || !input.contents || !input.problemSolved) {
      return ApiErrors.validationError('Missing required fields: leadMagnetTitle, contents, problemSolved');
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

    // Generate post variations
    const result = await generatePostVariations(input);

    // Update the lead magnet with post variations
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({
        post_variations: result.variations,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .eq('user_id', context.userId);

    if (updateError) {
      logApiError('external/lead-magnets/write-posts/update', updateError, { userId: context.userId, leadMagnetId: id });
      // Don't fail the request - just log it
    }

    return NextResponse.json(result);
  } catch (error) {
    logApiError('external/lead-magnets/write-posts', error);
    return ApiErrors.aiError('Failed to generate post variations');
  }
}

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
