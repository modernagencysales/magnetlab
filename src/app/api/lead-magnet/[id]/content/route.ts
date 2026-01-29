// API Route: Update polished content (for in-place editing)
// PUT /api/lead-magnet/[id]/content

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseServerClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { PolishedContent } from '@/lib/types/lead-magnet';

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
    const body = await request.json();
    const polishedContent = body.polishedContent as PolishedContent;

    if (!polishedContent || !polishedContent.sections) {
      return NextResponse.json({ error: 'Invalid content' }, { status: 400 });
    }

    // Recalculate metadata
    let wordCount = 0;
    for (const section of polishedContent.sections) {
      wordCount += section.introduction.split(/\s+/).length;
      wordCount += section.keyTakeaway.split(/\s+/).length;
      for (const block of section.blocks) {
        if (block.content) {
          wordCount += block.content.split(/\s+/).length;
        }
      }
    }
    wordCount += polishedContent.heroSummary.split(/\s+/).length;
    polishedContent.metadata = {
      wordCount,
      readingTimeMinutes: Math.max(1, Math.round(wordCount / 200)),
    };

    const supabase = await createSupabaseServerClient();

    const { data, error } = await supabase
      .from('lead_magnets')
      .update({ polished_content: polishedContent })
      .eq('id', id)
      .eq('user_id', session.user.id)
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
