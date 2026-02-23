// API Route: Update polished content (for in-place editing)
// PUT /api/lead-magnet/[id]/content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { validateBody, updateContentBodySchema } from '@/lib/validations/api';
import type { PolishedContent, PolishedSection } from '@/lib/types/lead-magnet';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { captureEdit } from '@/lib/services/edit-capture';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return ApiErrors.validationError('Invalid lead magnet ID');
    }

    const body = await request.json();
    const validation = validateBody(body, updateContentBodySchema);
    if (!validation.success) {
      return ApiErrors.validationError(validation.error, validation.details);
    }

    // Zod validates structure; passthrough() preserves extra fields like version/polishedAt
    const polishedContent = validation.data.polishedContent as unknown as PolishedContent;

    // Recalculate metadata
    let wordCount = 0;
    for (const section of polishedContent.sections) {
      wordCount += (section.introduction || '').split(/\s+/).filter(Boolean).length;
      wordCount += (section.keyTakeaway || '').split(/\s+/).filter(Boolean).length;
      for (const block of section.blocks) {
        if (block.content) {
          wordCount += block.content.split(/\s+/).length;
        }
      }
    }
    wordCount += (polishedContent.heroSummary || '').split(/\s+/).filter(Boolean).length;
    polishedContent.metadata = {
      wordCount,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    };

    const scope = await getDataScope(session.user.id);
    const supabase = createSupabaseAdminClient();

    // Fetch current content for edit diff comparison (before the update)
    let fetchQuery = supabase
      .from('lead_magnets')
      .select('polished_content')
      .eq('id', id);
    fetchQuery = applyScope(fetchQuery, scope);
    const { data: currentData } = await fetchQuery.single();
    const oldContent = currentData?.polished_content as PolishedContent | null;

    let query = supabase
      .from('lead_magnets')
      .update({ polished_content: polishedContent })
      .eq('id', id);
    query = applyScope(query, scope);
    const { data, error } = await query
      .select('polished_content')
      .single();

    if (error) {
      logApiError('lead-magnet/content/update', error, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to update content');
    }

    // Capture edits fire-and-forget (never blocks the response)
    if (oldContent && scope.teamId) {
      try {
        const teamId = scope.teamId;

        // Compare heroSummary
        if (oldContent.heroSummary && polishedContent.heroSummary) {
          captureEdit(supabase, {
            teamId,
            profileId: null,
            contentType: 'lead_magnet',
            contentId: id,
            fieldName: 'heroSummary',
            originalText: oldContent.heroSummary,
            editedText: polishedContent.heroSummary,
          }).catch(() => {});
        }

        // Compare section text fields
        const oldSections = oldContent.sections || [];
        const newSections = polishedContent.sections || [];
        for (let i = 0; i < newSections.length; i++) {
          const oldSection: PolishedSection | undefined = oldSections[i];
          const newSection = newSections[i];
          if (!oldSection) continue;

          if (oldSection.introduction && newSection.introduction) {
            captureEdit(supabase, {
              teamId,
              profileId: null,
              contentType: 'lead_magnet',
              contentId: id,
              fieldName: `section_${i}_introduction`,
              originalText: oldSection.introduction,
              editedText: newSection.introduction,
            }).catch(() => {});
          }

          if (oldSection.keyTakeaway && newSection.keyTakeaway) {
            captureEdit(supabase, {
              teamId,
              profileId: null,
              contentType: 'lead_magnet',
              contentId: id,
              fieldName: `section_${i}_keyTakeaway`,
              originalText: oldSection.keyTakeaway,
              editedText: newSection.keyTakeaway,
            }).catch(() => {});
          }

          // Compare block content within each section
          const oldBlocks = oldSection.blocks || [];
          const newBlocks = newSection.blocks || [];
          for (let j = 0; j < newBlocks.length; j++) {
            const oldBlock = oldBlocks[j];
            const newBlock = newBlocks[j];
            if (oldBlock?.content && newBlock?.content) {
              captureEdit(supabase, {
                teamId,
                profileId: null,
                contentType: 'lead_magnet',
                contentId: id,
                fieldName: `section_${i}_block_${j}_content`,
                originalText: oldBlock.content,
                editedText: newBlock.content,
              }).catch(() => {});
            }
          }
        }
      } catch {
        // Edit capture must never affect the save flow
      }
    }

    return NextResponse.json({ success: true, polishedContent: data.polished_content });
  } catch (error) {
    logApiError('lead-magnet/content/update', error);
    return ApiErrors.internalError('Failed to update content');
  }
}
