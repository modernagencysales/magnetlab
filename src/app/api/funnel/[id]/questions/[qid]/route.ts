// API Route: Single Qualification Question
// PUT, DELETE /api/funnel/[id]/questions/[qid]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  qualificationQuestionFromRow,
  type QualificationQuestionRow,
  type AnswerType,
} from '@/lib/types/funnel';
import { ApiErrors, logApiError } from '@/lib/api/errors';

const VALID_ANSWER_TYPES: AnswerType[] = ['yes_no', 'text', 'textarea', 'multiple_choice'];

interface RouteParams {
  params: Promise<{ id: string; qid: string }>;
}

// PUT - Update a question
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id, qid } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.questionText !== undefined) {
      updateData.question_text = body.questionText;
    }
    if (body.questionOrder !== undefined) {
      updateData.question_order = body.questionOrder;
    }
    if (body.answerType !== undefined) {
      if (!VALID_ANSWER_TYPES.includes(body.answerType)) {
        return ApiErrors.validationError('answerType must be one of: yes_no, text, textarea, multiple_choice');
      }
      updateData.answer_type = body.answerType;
    }
    if (body.qualifyingAnswer !== undefined) {
      updateData.qualifying_answer = body.qualifyingAnswer;
    }
    if (body.options !== undefined) {
      updateData.options = body.options;
    }
    if (body.placeholder !== undefined) {
      updateData.placeholder = body.placeholder;
    }
    if (body.isQualifying !== undefined) {
      updateData.is_qualifying = body.isQualifying;
    }
    if (body.isRequired !== undefined) {
      updateData.is_required = body.isRequired;
    }

    if (Object.keys(updateData).length === 0) {
      return ApiErrors.validationError('No valid fields to update');
    }

    // Update question
    const { data, error } = await supabase
      .from('qualification_questions')
      .update(updateData)
      .eq('id', qid)
      .eq('funnel_page_id', id)
      .select()
      .single();

    if (error) {
      logApiError('funnel/questions/update', error, { funnelId: id, questionId: qid });
      return ApiErrors.databaseError('Failed to update question');
    }

    if (!data) {
      return ApiErrors.notFound('Question');
    }

    return NextResponse.json({ question: qualificationQuestionFromRow(data as QualificationQuestionRow) });
  } catch (error) {
    logApiError('funnel/questions/update', error);
    return ApiErrors.internalError('Failed to update question');
  }
}

// DELETE - Delete a question
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id, qid } = await params;
    const supabase = createSupabaseAdminClient();

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnel) {
      return ApiErrors.notFound('Funnel page');
    }

    // Delete question
    const { error } = await supabase
      .from('qualification_questions')
      .delete()
      .eq('id', qid)
      .eq('funnel_page_id', id);

    if (error) {
      logApiError('funnel/questions/delete', error, { funnelId: id, questionId: qid });
      return ApiErrors.databaseError('Failed to delete question');
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('funnel/questions/delete', error);
    return ApiErrors.internalError('Failed to delete question');
  }
}
