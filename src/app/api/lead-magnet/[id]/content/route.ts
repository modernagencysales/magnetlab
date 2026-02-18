// API Route: Update polished content (for in-place editing)
// PUT /api/lead-magnet/[id]/content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError, isValidUUID } from '@/lib/api/errors';
import { validateBody, updateContentBodySchema } from '@/lib/validations/api';
import type { PolishedContent } from '@/lib/types/lead-magnet';
import { getDataScope, applyScope } from '@/lib/utils/team-context';

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

    return NextResponse.json({ success: true, polishedContent: data.polished_content });
  } catch (error) {
    logApiError('lead-magnet/content/update', error);
    return ApiErrors.internalError('Failed to update content');
  }
}
