// API Route: Get Extraction Questions / Process Extraction (Background Job)
// GET /api/lead-magnet/extract?archetype=single-system
// POST /api/lead-magnet/extract - Creates job, returns jobId (or sync for contextual-questions)

import { NextResponse } from 'next/server';
import { tasks } from '@trigger.dev/sdk/v3';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { getExtractionQuestions, getContextAwareExtractionQuestions } from '@/lib/ai/lead-magnet-generator';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import type { LeadMagnetArchetype } from '@/lib/types/lead-magnet';
import type { CreateJobResponse } from '@/lib/types/background-jobs';

// GET - Get extraction questions for an archetype (static, fast)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { searchParams } = new URL(request.url);
    const archetype = searchParams.get('archetype') as LeadMagnetArchetype;

    if (!archetype) {
      return ApiErrors.validationError('Missing archetype parameter');
    }

    const questions = getExtractionQuestions(archetype);

    return NextResponse.json({ questions });
  } catch (error) {
    logApiError('lead-magnet/extract/questions', error);
    return ApiErrors.internalError('Failed to get extraction questions');
  }
}

// POST - Process extraction answers OR get context-aware questions
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const body = await request.json();

    // Context-aware questions mode stays synchronous (fast, no AI generation)
    if (body.action === 'contextual-questions') {
      const { archetype, concept, businessContext } = body;
      if (!archetype || !concept || !businessContext) {
        return ApiErrors.validationError('Missing required fields: archetype, concept, businessContext');
      }
      const questions = await getContextAwareExtractionQuestions(archetype, concept, businessContext);
      return NextResponse.json({ questions });
    }

    // For content generation (interactive or standard), use background job
    const { archetype, concept, answers, transcriptInsights, businessContext, leadMagnetId } = body;

    if (!archetype || !concept || !answers) {
      return ApiErrors.validationError('Missing required fields: archetype, concept, answers');
    }

    const supabase = createSupabaseAdminClient();

    // Validate ownership if leadMagnetId provided
    if (leadMagnetId) {
      const { data: lm } = await supabase
        .from('lead_magnets')
        .select('id')
        .eq('id', leadMagnetId)
        .eq('user_id', session.user.id)
        .single();
      if (!lm) {
        return ApiErrors.notFound('Lead magnet');
      }
    }

    const jobInput = {
      archetype,
      concept,
      answers,
      transcriptInsights,
      ...(body.action === 'generate-interactive' ? { action: 'generate-interactive' as const, businessContext } : {}),
    };

    // Create job record
    const { data: job, error: jobError } = await supabase
      .from('background_jobs')
      .insert({
        user_id: session.user.id,
        job_type: 'extraction',
        status: 'pending',
        input: jobInput,
      })
      .select('id')
      .single();

    if (jobError || !job) {
      logApiError('lead-magnet/extract/create-job', jobError, { userId: session.user.id });
      return ApiErrors.databaseError('Failed to create job');
    }

    // Trigger background task
    const handle = await tasks.trigger('extract-content', {
      jobId: job.id,
      userId: session.user.id,
      leadMagnetId: leadMagnetId || null,
      input: jobInput,
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
    logApiError('lead-magnet/extract', error);
    return ApiErrors.internalError('Failed to start extraction');
  }
}
