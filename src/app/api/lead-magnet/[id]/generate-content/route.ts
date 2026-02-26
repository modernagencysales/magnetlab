// API Route: Generate + Polish Lead Magnet Content (from concept, no extractedContent needed)
// POST /api/lead-magnet/[id]/generate-content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { generateFullContent } from '@/lib/ai/generate-lead-magnet-content';
import { polishLeadMagnetContent } from '@/lib/ai/lead-magnet-generator';
import { getRelevantContext } from '@/lib/services/knowledge-brain';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetConcept } from '@/lib/types/lead-magnet';
import { getPostHogServerClient } from '@/lib/posthog';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

export const maxDuration = 60;

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

    // Fetch lead magnet
    let fetchQuery = supabase
      .from('lead_magnets')
      .select('id, title, concept, user_id')
      .eq('id', id);
    fetchQuery = applyScope(fetchQuery, scope);
    const { data: leadMagnet, error: fetchError } = await fetchQuery.single();

    if (fetchError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    if (!leadMagnet.concept) {
      return ApiErrors.validationError('Lead magnet has no concept — cannot generate content');
    }

    const concept = leadMagnet.concept as LeadMagnetConcept;

    // Fetch knowledge context (best-effort)
    let knowledgeContext = '';
    try {
      const searchQuery = `${leadMagnet.title} ${concept.painSolved || ''} ${concept.contents || ''}`;
      const knowledge = await getRelevantContext(session.user.id, searchQuery, 15);
      if (knowledge.entries.length > 0) {
        knowledgeContext = knowledge.entries
          .map((e) => `[${e.category}] ${e.content}`)
          .join('\n\n');
      }
    } catch {
      // Continue without knowledge context
    }

    // Generate full ExtractedContent
    const extractedContent = await generateFullContent(leadMagnet.title, concept, knowledgeContext);

    // Save extracted_content immediately
    let saveQuery = supabase
      .from('lead_magnets')
      .update({ extracted_content: extractedContent })
      .eq('id', id);
    saveQuery = applyScope(saveQuery, scope);
    const { error: saveError } = await saveQuery;

    if (saveError) {
      logApiError('lead-magnet/generate-content', saveError, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to save generated content');
    }

    // Polish into rich block format
    const polishedContent = await polishLeadMagnetContent(extractedContent, concept);
    const polishedAt = new Date().toISOString();

    // Save polished content
    let polishQuery = supabase
      .from('lead_magnets')
      .update({
        polished_content: polishedContent,
        polished_at: polishedAt,
      })
      .eq('id', id);
    polishQuery = applyScope(polishQuery, scope);
    const { error: polishError } = await polishQuery;

    if (polishError) {
      logApiError('lead-magnet/generate-content', polishError, { userId: session.user.id, leadMagnetId: id });
      // extractedContent was already saved — return partial success
    }

    try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'content_generated_and_polished', properties: { lead_magnet_id: id } }); } catch {}

    return NextResponse.json({
      extractedContent,
      polishedContent,
      polishedAt,
    });
  } catch (error) {
    logApiError('lead-magnet/generate-content', error);
    return ApiErrors.aiError('Failed to generate content. Please try again.');
  }
}
