// API Route: Qualification Questions
// GET, POST, PATCH /api/funnel/[id]/questions

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
  params: Promise<{ id: string }>;
}

// GET - List all questions for a funnel
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
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

    // Get questions
    const { data, error } = await supabase
      .from('qualification_questions')
      .select('*')
      .eq('funnel_page_id', id)
      .order('question_order', { ascending: true });

    if (error) {
      logApiError('funnel/questions/list', error, { funnelId: id });
      return ApiErrors.databaseError('Failed to fetch questions');
    }

    const questions = (data as QualificationQuestionRow[]).map(qualificationQuestionFromRow);

    return NextResponse.json({ questions });
  } catch (error) {
    logApiError('funnel/questions/list', error);
    return ApiErrors.internalError('Failed to fetch questions');
  }
}

// POST - Create a new question
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Validate required fields
    if (!body.questionText) {
      return ApiErrors.validationError('questionText is required');
    }

    const answerType: AnswerType = body.answerType || 'yes_no';
    if (!VALID_ANSWER_TYPES.includes(answerType)) {
      return ApiErrors.validationError('answerType must be one of: yes_no, text, textarea, multiple_choice');
    }

    // Validate options for multiple_choice
    if (answerType === 'multiple_choice') {
      if (!body.options || !Array.isArray(body.options) || body.options.length < 2) {
        return ApiErrors.validationError('multiple_choice questions require at least 2 options');
      }
    }

    // Determine qualifying answer
    const isQualifying = body.isQualifying ?? (answerType === 'yes_no');
    let qualifyingAnswer = null;

    if (isQualifying) {
      if (answerType === 'yes_no') {
        qualifyingAnswer = body.qualifyingAnswer || 'yes';
        if (qualifyingAnswer !== 'yes' && qualifyingAnswer !== 'no') {
          return ApiErrors.validationError('qualifyingAnswer must be "yes" or "no" for yes_no questions');
        }
      } else if (answerType === 'multiple_choice') {
        qualifyingAnswer = body.qualifyingAnswer || null;
        if (qualifyingAnswer && !Array.isArray(qualifyingAnswer)) {
          return ApiErrors.validationError('qualifyingAnswer must be an array for multiple_choice questions');
        }
      }
    }

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

    // Get max order for this funnel
    const { data: maxOrderResult } = await supabase
      .from('qualification_questions')
      .select('question_order')
      .eq('funnel_page_id', id)
      .order('question_order', { ascending: false })
      .limit(1)
      .single();

    const nextOrder = body.questionOrder ?? ((maxOrderResult?.question_order ?? -1) + 1);

    // Create question
    const { data, error } = await supabase
      .from('qualification_questions')
      .insert({
        funnel_page_id: id,
        question_text: body.questionText,
        question_order: nextOrder,
        answer_type: answerType,
        qualifying_answer: qualifyingAnswer,
        options: answerType === 'multiple_choice' ? body.options : null,
        placeholder: body.placeholder || null,
        is_qualifying: isQualifying,
        is_required: body.isRequired ?? true,
      })
      .select()
      .single();

    if (error) {
      logApiError('funnel/questions/create', error, { funnelId: id });
      return ApiErrors.databaseError('Failed to create question');
    }

    return NextResponse.json(
      { question: qualificationQuestionFromRow(data as QualificationQuestionRow) },
      { status: 201 }
    );
  } catch (error) {
    logApiError('funnel/questions/create', error);
    return ApiErrors.internalError('Failed to create question');
  }
}

// PATCH - Reorder questions (bulk update)
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return ApiErrors.unauthorized();
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Validate request body
    if (!body.questionIds || !Array.isArray(body.questionIds)) {
      return ApiErrors.validationError('questionIds array is required');
    }

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

    // Update each question's order in parallel
    const updates = body.questionIds.map((questionId: string, index: number) =>
      supabase
        .from('qualification_questions')
        .update({ question_order: index })
        .eq('id', questionId)
        .eq('funnel_page_id', id)
    );

    const results = await Promise.all(updates);

    // Check if any updates failed
    const failedUpdate = results.find(r => r.error);
    if (failedUpdate?.error) {
      logApiError('funnel/questions/reorder', failedUpdate.error, { funnelId: id });
      return ApiErrors.databaseError('Failed to reorder questions');
    }

    // Return success without refetching - client already has correct order
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('funnel/questions/reorder', error);
    return ApiErrors.internalError('Failed to reorder questions');
  }
}
