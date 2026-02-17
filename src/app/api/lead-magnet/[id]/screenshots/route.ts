// API Route: Generate Content Page Screenshots
// POST /api/lead-magnet/[id]/screenshots

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import {
  generateContentScreenshots,
  closeScreenshotBrowser,
} from '@/lib/services/screenshot';
import type { PolishedContent, ScreenshotUrl } from '@/lib/types/lead-magnet';

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
    const supabase = createSupabaseAdminClient();

    // Get the lead magnet and verify ownership
    const { data: leadMagnet, error: fetchError } = await supabase
      .from('lead_magnets')
      .select('id, user_id, polished_content, interactive_config, extracted_content')
      .eq('id', id)
      .single();

    if (fetchError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    if (leadMagnet.user_id !== session.user.id) {
      return ApiErrors.forbidden('You do not own this lead magnet');
    }

    // Verify some renderable content exists (polished, interactive, or extracted)
    const polishedContent = leadMagnet.polished_content as PolishedContent | null;
    const hasPolished = !!polishedContent?.sections?.length;
    const hasInteractive = !!leadMagnet.interactive_config;
    const hasExtracted = !!leadMagnet.extracted_content;

    if (!hasPolished && !hasInteractive && !hasExtracted) {
      return ApiErrors.validationError(
        'No content available to screenshot. Create content or an interactive tool first.'
      );
    }

    // Find published funnel page for this lead magnet
    const { data: funnelPage, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, slug, user_id')
      .eq('lead_magnet_id', id)
      .eq('is_published', true)
      .limit(1)
      .single();

    if (funnelError || !funnelPage) {
      return ApiErrors.validationError(
        'No published funnel page found for this lead magnet. Publish a funnel page first.'
      );
    }

    // Get username to build public URL
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username')
      .eq('id', funnelPage.user_id)
      .single();

    if (userError || !user?.username) {
      return ApiErrors.validationError(
        'Username not set. Go to Settings to set your username before generating screenshots.'
      );
    }

    // Build the public content page URL
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://magnetlab.ai';
    const pageUrl = `${appUrl}/p/${user.username}/${funnelPage.slug}/content`;

    // Generate screenshots (section shots only for polished content)
    const sectionCount = hasPolished ? polishedContent!.sections.length : 0;
    let screenshotResults;
    try {
      screenshotResults = await generateContentScreenshots({
        pageUrl,
        sectionCount,
      });
    } catch (screenshotError) {
      logApiError('lead-magnet/screenshots/generate', screenshotError, {
        userId: session.user.id,
        leadMagnetId: id,
        pageUrl,
      });
      return ApiErrors.internalError('Failed to generate screenshots');
    } finally {
      await closeScreenshotBrowser();
    }

    // Upload each screenshot to Supabase Storage and collect URLs
    const screenshotUrls: ScreenshotUrl[] = [];

    for (const result of screenshotResults) {
      const prefix =
        result.type === 'hero' ? 'hero' : `section-${result.sectionIndex}`;

      // Upload 1200x627
      const path1200 = `screenshots/${session.user.id}/${id}/${prefix}-1200x627.png`;
      const { error: upload1200Error } = await supabase.storage
        .from('magnetlab')
        .upload(path1200, result.buffer1200x627, {
          contentType: 'image/png',
          upsert: true,
        });

      if (upload1200Error) {
        logApiError('lead-magnet/screenshots/upload', upload1200Error, {
          path: path1200,
        });
        return ApiErrors.databaseError('Failed to upload screenshot');
      }

      // Upload 1080x1080
      const path1080 = `screenshots/${session.user.id}/${id}/${prefix}-1080x1080.png`;
      const { error: upload1080Error } = await supabase.storage
        .from('magnetlab')
        .upload(path1080, result.buffer1080x1080, {
          contentType: 'image/png',
          upsert: true,
        });

      if (upload1080Error) {
        logApiError('lead-magnet/screenshots/upload', upload1080Error, {
          path: path1080,
        });
        return ApiErrors.databaseError('Failed to upload screenshot');
      }

      // Get public URLs
      const { data: url1200Data } = supabase.storage
        .from('magnetlab')
        .getPublicUrl(path1200);

      const { data: url1080Data } = supabase.storage
        .from('magnetlab')
        .getPublicUrl(path1080);

      screenshotUrls.push({
        type: result.type,
        sectionIndex: result.sectionIndex,
        sectionName: result.sectionName,
        url1200x627: url1200Data.publicUrl,
        url1080x1080: url1080Data.publicUrl,
      });
    }

    // Save screenshot URLs to the lead_magnets table
    const { error: updateError } = await supabase
      .from('lead_magnets')
      .update({ screenshot_urls: screenshotUrls })
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (updateError) {
      logApiError('lead-magnet/screenshots/save', updateError, {
        userId: session.user.id,
        leadMagnetId: id,
      });
      return ApiErrors.databaseError('Failed to save screenshot URLs');
    }

    return NextResponse.json({ screenshotUrls });
  } catch (error) {
    logApiError('lead-magnet/screenshots', error);
    return ApiErrors.internalError('Failed to generate screenshots');
  }
}
