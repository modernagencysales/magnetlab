// API Route: External Funnel Publish/Unpublish
// POST /api/external/funnels/[id]/publish - Toggle publish status
//
// Authenticated via withExternalAuth (service-to-service auth)

import { NextRequest, NextResponse } from 'next/server';
import { withExternalAuth, ExternalAuthContext } from '@/lib/middleware/external-auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import type { ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';

interface PublishRequestBody {
  publish: boolean;
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
    const idIndex = pathParts.indexOf('funnels') + 1;
    const id = pathParts[idIndex];

    if (!id) {
      return ApiErrors.validationError('Funnel ID is required');
    }

    const reqBody = body as PublishRequestBody;
    const { publish } = reqBody;

    if (typeof publish !== 'boolean') {
      return ApiErrors.validationError('publish must be a boolean');
    }

    const supabase = createSupabaseAdminClient();

    // Get current funnel page
    const { data: funnel, error: fetchError } = await supabase
      .from('funnel_pages')
      .select('*, lead_magnets!inner(id)')
      .eq('id', id)
      .eq('user_id', context.userId)
      .single();

    if (fetchError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Check if user has username set (required for publishing)
    if (publish) {
      const { data: user } = await supabase
        .from('users')
        .select('username')
        .eq('id', context.userId)
        .single();

      if (!user?.username) {
        return ApiErrors.validationError('You must set a username before publishing. Go to Settings to set your username.');
      }

      // Validate funnel has required fields
      if (!funnel.optin_headline) {
        return ApiErrors.validationError('Opt-in headline is required before publishing');
      }
    }

    // Auto-polish content on first publish if needed
    if (publish) {
      try {
        const { data: lm } = await supabase
          .from('lead_magnets')
          .select('id, extracted_content, polished_content, concept')
          .eq('id', funnel.lead_magnets.id)
          .single();

        if (lm?.extracted_content && !lm.polished_content && lm.concept) {
          const polished = await polishLeadMagnetContent(
            lm.extracted_content as ExtractedContent,
            lm.concept as LeadMagnetConcept
          );
          await supabase
            .from('lead_magnets')
            .update({
              polished_content: polished,
              polished_at: new Date().toISOString(),
            })
            .eq('id', lm.id);
        }
      } catch (polishError) {
        // Don't block publishing if polish fails
        logApiError('external/funnels/publish/auto-polish', polishError, { userId: context.userId, funnelId: id });
      }
    }

    // Update publish status
    const updateData: Record<string, unknown> = {
      is_published: publish,
    };

    if (publish && !funnel.published_at) {
      updateData.published_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('funnel_pages')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', context.userId)
      .select()
      .single();

    if (error) {
      logApiError('external/funnels/publish', error, { userId: context.userId, funnelId: id });
      return ApiErrors.databaseError('Failed to update publish status');
    }

    // Get username for URL
    const { data: user } = await supabase
      .from('users')
      .select('username')
      .eq('id', context.userId)
      .single();

    const publicUrl = publish && user?.username
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/p/${user.username}/${funnel.slug}`
      : null;

    return NextResponse.json({
      funnel: funnelPageFromRow(data as FunnelPageRow),
      publicUrl,
    });
  } catch (error) {
    logApiError('external/funnels/publish', error);
    return ApiErrors.internalError('Failed to update publish status');
  }
}

export const POST = withExternalAuth(async (request, context, body) => {
  return handlePost(request, context, body);
});
