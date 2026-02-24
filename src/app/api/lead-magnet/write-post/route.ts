// API Route: Generate LinkedIn Post Variations (Background Job)
// POST /api/lead-magnet/write-post - Creates job, returns jobId

import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { PostWriterInput } from '@/lib/types/lead-magnet';
import type { CreateJobResponse } from '@/lib/types/background-jobs';

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();
    const input = body as PostWriterInput;

    // Validate required fields
    if (!input.leadMagnetTitle || !input.contents || !input.problemSolved) {
      return ApiErrors.validationError('Missing required fields: leadMagnetTitle, contents, problemSolved');
    }

    const supabase = createSupabaseAdminClient();

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .insert({
        user_id: session.user.id,
        job_type: 'posts',
        status: 'pending',
        input,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      logApiError('lead-magnet/write-post/create-job', jobError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create job');
    }

    // Trigger background task
    const handle = await tasks.trigger('write-posts', {
      jobId: job.id,
      userId: session.user.id,
      input,
    });

    // Update job with trigger task ID
    await supabase
      .from('background_jobs')
      .update({ trigger_task_id: handle.id })
      .eq('id', job.id);

    const response: CreateJobResponse = {
      jobId: job.id,
      status: 'pending',
    };

    return NextResponse.json(response);
  } catch (error) {
    logApiError('lead-magnet/write-post', error);
    return ApiErrors.internalError('Failed to start post generation');
  }
}
