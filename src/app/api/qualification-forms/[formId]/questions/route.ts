import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as qualificationFormsService from '@/server/services/qualification-forms.service';
import type { AnswerType } from '@/lib/types/funnel';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId } = await params;
    const result = await qualificationFormsService.listQuestions(session.user.id, formId);
    if (!result) return ApiErrors.notFound('Qualification form');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('qualification-forms/questions/list', error);
    return ApiErrors.internalError('Failed to fetch questions');
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId } = await params;
    const body = await request.json();

    if (!body.questionText) return ApiErrors.validationError('questionText is required');

    const answerType: AnswerType = body.answerType || 'yes_no';
    if (!qualificationFormsService.VALID_ANSWER_TYPES.includes(answerType)) {
      return ApiErrors.validationError('answerType must be one of: yes_no, text, textarea, multiple_choice');
    }

    if (answerType === 'multiple_choice') {
      if (!body.options || !Array.isArray(body.options) || body.options.length < 2) {
        return ApiErrors.validationError('multiple_choice questions require at least 2 options');
      }
    }

    const isQualifying = body.isQualifying ?? (answerType === 'yes_no');
    let qualifyingAnswer: string | string[] | null = null;
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

    const result = await qualificationFormsService.createQuestion(session.user.id, formId, {
      questionText: body.questionText,
      answerType,
      questionOrder: body.questionOrder,
      qualifyingAnswer,
      options: answerType === 'multiple_choice' ? body.options : undefined,
      placeholder: body.placeholder,
      isQualifying,
      isRequired: body.isRequired ?? true,
    });
    if (!result) return ApiErrors.notFound('Qualification form');
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    logApiError('qualification-forms/questions/create', error);
    return ApiErrors.internalError('Failed to create question');
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ formId: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId } = await params;
    const body = await request.json();
    if (!body.questionIds || !Array.isArray(body.questionIds)) {
      return ApiErrors.validationError('questionIds array is required');
    }

    const result = await qualificationFormsService.reorderQuestions(session.user.id, formId, body.questionIds);
    if (!result) return ApiErrors.notFound('Qualification form');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('qualification-forms/questions/reorder', error);
    return ApiErrors.internalError('Failed to reorder questions');
  }
}
