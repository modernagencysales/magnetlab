import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as qualificationFormsService from '@/server/services/qualification-forms.service';
import type { AnswerType } from '@/lib/types/funnel';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ formId: string; qid: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId, qid } = await params;
    const body = await request.json();

    const updates: Record<string, unknown> = {};
    if (body.questionText !== undefined) updates.questionText = body.questionText;
    if (body.questionOrder !== undefined) updates.questionOrder = body.questionOrder;
    if (body.answerType !== undefined) {
      if (!qualificationFormsService.VALID_ANSWER_TYPES.includes(body.answerType as AnswerType)) {
        return ApiErrors.validationError('answerType must be one of: yes_no, text, textarea, multiple_choice');
      }
      updates.answerType = body.answerType;
    }
    if (body.qualifyingAnswer !== undefined) updates.qualifyingAnswer = body.qualifyingAnswer;
    if (body.options !== undefined) updates.options = body.options;
    if (body.placeholder !== undefined) updates.placeholder = body.placeholder;
    if (body.isQualifying !== undefined) updates.isQualifying = body.isQualifying;
    if (body.isRequired !== undefined) updates.isRequired = body.isRequired;

    if (Object.keys(updates).length === 0) {
      return ApiErrors.validationError('No valid fields to update');
    }

    const result = await qualificationFormsService.updateQuestion(session.user.id, formId, qid, updates);
    if (!result) return ApiErrors.notFound('Question');
    return NextResponse.json(result);
  } catch (error) {
    logApiError('qualification-forms/questions/update', error);
    return ApiErrors.internalError('Failed to update question');
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ formId: string; qid: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const { formId, qid } = await params;
    const result = await qualificationFormsService.deleteQuestion(session.user.id, formId, qid);
    if (!result) return ApiErrors.notFound('Qualification form');
    return NextResponse.json({ success: true });
  } catch (error) {
    logApiError('qualification-forms/questions/delete', error);
    return ApiErrors.internalError('Failed to delete question');
  }
}
