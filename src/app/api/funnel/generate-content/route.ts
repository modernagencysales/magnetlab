// API Route: Generate AI Content for Funnel Page
// POST /api/funnel/generate-content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import {
  generateOptinContent,
  generateDefaultOptinContent,
} from '@/lib/ai/funnel-content-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetConcept, ExtractedContent } from '@/lib/types/lead-magnet';

// POST - Generate opt-in page content
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const { leadMagnetId, useAI = true } = body;

    if (!leadMagnetId) {
      return ApiErrors.validationError('leadMagnetId is required');
    }

    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    // Fetch lead magnet data
    let lmQuery = supabase
      .from('lead_magnets')
      .select('title, concept, extracted_content')
      .eq('id', leadMagnetId);
    lmQuery = applyScope(lmQuery, scope);
    const { data: leadMagnet, error: lmError } = await lmQuery.single();

    if (lmError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Fetch brand kit for credibility
    let bkQuery = supabase
      .from('brand_kits')
      .select('credibility_markers');
    bkQuery = applyScope(bkQuery, scope);
    const { data: brandKit } = await bkQuery.single();

    const credibility = brandKit?.credibility_markers?.join('. ') || undefined;

    let content;

    if (useAI) {
      try {
        content = await generateOptinContent({
          leadMagnetTitle: leadMagnet.title,
          concept: leadMagnet.concept as LeadMagnetConcept | null,
          extractedContent: leadMagnet.extracted_content as ExtractedContent | null,
          credibility,
        });
      } catch (aiError) {
        logApiError('funnel/generate-content/ai', aiError, { leadMagnetId, note: 'Falling back to default' });
        content = generateDefaultOptinContent(
          leadMagnet.title,
          leadMagnet.concept as LeadMagnetConcept | null
        );
      }
    } else {
      content = generateDefaultOptinContent(
        leadMagnet.title,
        leadMagnet.concept as LeadMagnetConcept | null
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    logApiError('funnel/generate-content', error);
    return ApiErrors.internalError('Failed to generate content');
  }
}
