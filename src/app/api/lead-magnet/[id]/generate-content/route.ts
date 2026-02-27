// API Route: Generate + Polish Lead Magnet Content (from concept, no extractedContent needed)
// POST /api/lead-magnet/[id]/generate-content
//
// Triggers a Trigger.dev background task (rebuild-lead-magnet-content) instead of
// running AI calls inline, avoiding Vercel serverless timeout issues (MOD-348).

import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getPostHogServerClient } from '@/lib/posthog';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import type { rebuildLeadMagnetContent } from '@/trigger/rebuild-lead-magnet-content';

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
      .select('id, title, concept, user_id, status')
      .eq('id', id);
    fetchQuery = applyScope(fetchQuery, scope);
    const { data: leadMagnet, error: fetchError } = await fetchQuery.single();

    if (fetchError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    if (!leadMagnet.concept) {
      return ApiErrors.validationError('Lead magnet has no concept — cannot generate content');
    }

    // Mark as processing so the client can poll
    const previousStatus = leadMagnet.status;
    let statusQuery = supabase
      .from('lead_magnets')
      .update({ status: 'processing' })
      .eq('id', id);
    statusQuery = applyScope(statusQuery, scope);
    await statusQuery;

    // Trigger background task (10 min timeout, 2 retries)
    await tasks.trigger<typeof rebuildLeadMagnetContent>('rebuild-lead-magnet-content', {
      leadMagnetId: id,
      userId: session.user.id,
      previousStatus: previousStatus || 'draft',
    });

    try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'content_generation_triggered', properties: { lead_magnet_id: id } }); } catch {}

    return NextResponse.json({ status: 'processing' });
  } catch (error) {
    logApiError('lead-magnet/generate-content', error);
    return ApiErrors.aiError('Failed to start content generation. Please try again.');
  }
}
