// API Route: Polish Lead Magnet Content
// POST /api/lead-magnet/[id]/polish

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { ExtractedContent, LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { getPostHogServerClient } from '@/lib/posthog';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Get the lead magnet
    let fetchQuery = supabase
      .from('lead_magnets')
      .select('id, extracted_content, concept, user_id')
      .eq('id', id);
    fetchQuery = applyScope(fetchQuery, scope);
    const { data: leadMagnet, error: fetchError } = await fetchQuery.single();

    if (fetchError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    if (!leadMagnet.extracted_content) {
      return ApiErrors.validationError('Lead magnet has no extracted content to polish');
    }

    if (!leadMagnet.concept) {
      return ApiErrors.validationError('Lead magnet has no concept');
    }

    const extractedContent = leadMagnet.extracted_content as ExtractedContent;
    const concept = leadMagnet.concept as LeadMagnetConcept;

    // Run AI polish
    const polishedContent = await polishLeadMagnetContent(extractedContent, concept);
    const polishedAt = new Date().toISOString();

    // Save to database
    let updateQuery = supabase
      .from('lead_magnets')
      .update({
        polished_content: polishedContent,
        polished_at: polishedAt,
      })
      .eq('id', id);
    updateQuery = applyScope(updateQuery, scope);
    const { error: updateError } = await updateQuery;

    if (updateError) {
      logApiError('lead-magnet/polish', updateError, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to save polished content');
    }

    try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'content_polished', properties: { lead_magnet_id: id } }); } catch {}

    return NextResponse.json({
      polishedContent,
      polishedAt,
    });
  } catch (error) {
    logApiError('lead-magnet/polish', error);
    return ApiErrors.aiError('Failed to polish content. Please try again.');
  }
}
