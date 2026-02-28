<<<<<<< HEAD
=======
// API Route: Generate + Polish Lead Magnet Content (Background Job)
// POST /api/lead-magnet/[id]/generate-content

>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { auth } from '@/lib/auth';
<<<<<<< HEAD
import { ApiErrors } from '@/lib/api/errors';
import { getDataScope } from '@/lib/utils/team-context';
import * as leadMagnetsService from '@/server/services/lead-magnets.service';

export const maxDuration = 60;
=======
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { getPostHogServerClient } from '@/lib/posthog';
import { getDataScope, applyScope } from '@/lib/utils/team-context';
import type { CreateJobResponse } from '@/lib/types/background-jobs';
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { id } = await params;
    const scope = await getDataScope(session.user.id);
<<<<<<< HEAD
    const result = await leadMagnetsService.generateAndPolishContent(scope, id);
    return NextResponse.json(result);
  } catch (error) {
    const status = leadMagnetsService.getStatusCode(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status });
=======
    const supabase = createSupabaseAdminClient();

    // Verify lead magnet exists and has a concept
    let fetchQuery = supabase
      .from('lead_magnets')
      .select('id, concept, user_id')
      .eq('id', id);
    fetchQuery = applyScope(fetchQuery, scope);
    const { data: leadMagnet, error: fetchError } = await fetchQuery.single();

    if (fetchError || !leadMagnet) {
      return ApiErrors.notFound('Lead magnet');
    }

    if (!leadMagnet.concept) {
      return ApiErrors.validationError('Lead magnet has no concept — cannot generate content');
    }

    // Create background job
    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .insert({
        user_id: session.user.id,
        job_type: 'content-generation',
        status: 'pending',
        input: { leadMagnetId: id, mode: 'generate-and-polish' },
      })
      .select('id')
      .single();

    if (jobError || !job) {
      logApiError('lead-magnet/generate-content/create-job', jobError, { userId: session.user.id, leadMagnetId: id });
      return ApiErrors.databaseError('Failed to create job');
    }

    // Trigger background task
    const handle = await tasks.trigger('polish-lead-magnet-content', {
      jobId: job.id,
      userId: session.user.id,
      leadMagnetId: id,
      mode: 'generate-and-polish' as const,
    });

    // Update job with trigger task ID
    await supabase
      .from('background_jobs')
      .update({ trigger_task_id: handle.id })
      .eq('id', job.id);

    try { getPostHogServerClient()?.capture({ distinctId: session.user.id, event: 'content_generation_started', properties: { lead_magnet_id: id } }); } catch {}

    const response: CreateJobResponse = {
      jobId: job.id,
      status: 'pending',
    };

    return NextResponse.json(response);
  } catch (error) {
    logApiError('lead-magnet/generate-content', error);
    return ApiErrors.internalError('Failed to start content generation');
>>>>>>> cd46c59795c3148789086a657c2176e3dd0f8a47
  }
}
