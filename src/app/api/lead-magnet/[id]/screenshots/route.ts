// API Route: Generate Content Page Screenshots
// POST — triggers Trigger.dev task, polls for result
// GET — returns current screenshot URLs from DB

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { tasks, runs } from '@trigger.dev/sdk/v3';
import type { generateScreenshots } from '@/trigger/generate-screenshots';
import type { PolishedContent, PolishedSection } from '@/lib/types/lead-magnet';

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
    const supabase = createSupabaseAdminClient();
    const scope = await getDataScope(session.user.id);

    // Get the lead magnet and verify ownership
    let lmQuery = supabase
      .from('lead_magnets')
      .select('id, user_id, polished_content, interactive_config, extracted_content')
      .eq('id', id);
    lmQuery = applyScope(lmQuery, scope);
    const { data: leadMagnet, error: fetchError } = await lmQuery.single();

    if (fetchError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    // Verify some renderable content exists
    const polishedContent = leadMagnet.polished_content as PolishedContent | null;
    const hasPolished = !!polishedContent?.sections?.length;
    const hasInteractive = !!leadMagnet.interactive_config;
    const hasExtracted = !!leadMagnet.extracted_content;

    if (!hasPolished && !hasInteractive && !hasExtracted) {
      return ApiErrors.validationError(
        'No content available to screenshot. Create content or an interactive tool first.'
      );
    }

    // Find published funnel page
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

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://magnetlab.app';
    const pageUrl = `${appUrl}/p/${user.username}/${funnelPage.slug}/content`;

    const sectionCount = hasPolished ? polishedContent!.sections.length : 0;
    const polishedSectionNames = hasPolished
      ? polishedContent!.sections.map((s: PolishedSection, i: number) => s.sectionName || `Section ${i + 1}`)
      : undefined;

    // Trigger the screenshot task on Trigger.dev
    const handle = await tasks.trigger<typeof generateScreenshots>('generate-screenshots', {
      pageUrl,
      sectionCount,
      userId: session.user.id,
      leadMagnetId: id,
      polishedSectionNames,
    });

    // Poll for the result (task runs on Trigger.dev infra, not Vercel)
    try {
      const completed = await runs.poll(handle.id, { pollIntervalMs: 2000 });

      if (completed.status === 'COMPLETED' && completed.output) {
        return NextResponse.json({ screenshotUrls: completed.output.screenshotUrls });
      }

      const errMsg = completed.error?.message || `Task status: ${completed.status}`;
      logApiError('lead-magnet/screenshots/task-failed', new Error(errMsg), {
        userId: session.user.id,
        leadMagnetId: id,
        runId: handle.id,
      });
      return ApiErrors.internalError(`Screenshot generation failed: ${errMsg}`);
    } catch (pollError) {
      logApiError('lead-magnet/screenshots/poll', pollError, {
        userId: session.user.id,
        leadMagnetId: id,
        runId: handle.id,
      });
      const errMsg = pollError instanceof Error ? pollError.message : String(pollError);
      return ApiErrors.internalError(`Failed to generate screenshots: ${errMsg}`);
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    logApiError('lead-magnet/screenshots', error);
    return ApiErrors.internalError(`Failed to generate screenshots: ${errMsg}`);
  }
}
