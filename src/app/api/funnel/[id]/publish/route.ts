// API Route: Publish/Unpublish Funnel Page
// POST /api/funnel/[id]/publish

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { funnelPageFromRow, type FunnelPageRow } from '@/lib/types/funnel';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import type { ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { getPostHogServerClient } from '@/lib/posthog';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST - Toggle publish status
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid funnel page ID');
    }

    const body = await request.json();
    const { publish } = body;

    if (typeof publish !== 'boolean') {
      return ApiErrors.validationError('publish must be a boolean');
    }

    const supabase = createSupabaseAdminClient();

    // Get current funnel page (left join so non-lead_magnet funnels still work)
    const { data: funnel, error: fetchError } = await supabase
      .from('funnel_pages')
      .select('*, lead_magnets(id)')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Check if user has username set (required for publishing)
    let cachedUsername: string | null = null;
    if (publish) {
      const { data: user } = await supabase
        .from('users')
        .select('username')
        .eq('id', session.user.id)
        .single();

      if (!user?.username) {
        return ApiErrors.validationError('You must set a username before publishing. Go to Settings to set your username.');
      }
      cachedUsername = user.username;

      // Validate funnel has required fields
      if (!funnel.optin_headline) {
        return ApiErrors.validationError('Opt-in headline is required before publishing');
      }
    }

    // Auto-polish content on first publish if needed (only for lead_magnet funnels)
    if (publish && funnel.lead_magnets) {
      try {
        const { data: lm } = await supabase
          .from('lead_magnets')
          .select('id, extracted_content, polished_content, concept')
          .eq('id', funnel.lead_magnets.id)
          .eq('user_id', session.user.id)
          .single();

        if (lm?.extracted_content && !lm.polished_content && lm.concept) {
          const polished = await polishLeadMagnetContent(
            lm.extracted_content as ExtractedContent,
            lm.concept as LeadMagnetConcept,
            { formattingOnly: true }
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
        logApiError('funnel/publish/auto-polish', polishError, { userId: session.user.id, funnelId: id });
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
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      logApiError('funnel/publish', error, { userId: session.user.id, funnelId: id });
      return ApiErrors.databaseError('Failed to update publish status');
    }

    const publicUrl = publish && cachedUsername
      ? `${process.env.NEXT_PUBLIC_APP_URL || ''}/p/${cachedUsername}/${funnel.slug}`
      : null;

    if (publish) {
      try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'funnel_published', properties: { funnel_id: id, slug: funnel.slug, has_public_url: !!publicUrl } }); } catch {}
    }

    return NextResponse.json({
      funnel: funnelPageFromRow(data as FunnelPageRow),
      publicUrl,
    });
  } catch (error) {
    logApiError('funnel/publish', error);
    return ApiErrors.internalError('Failed to update publish status');
  }
}
