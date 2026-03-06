// API Route: Public - Get qualification questions for a funnel page
// GET /api/public/questions/[id]

import { NextResponse } from 'next/server';
import { logApiError } from '@/lib/api/errors';
import * as publicService from '@/server/services/public.service';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id: funnelPageId } = await params;
    const { questions, error } = await publicService.getPublicQuestions(funnelPageId);

    if (error || !questions) {
      return NextResponse.json({ error: error ?? 'Page not found' }, { status: questions ? 500 : 404 });
    }

    const mapped = questions.map((q) => ({
      id: q.id,
      questionText: q.question_text,
      questionOrder: q.question_order,
      answerType: q.answer_type,
      options: q.options,
      placeholder: q.placeholder,
      isRequired: q.is_required,
    }));

    return NextResponse.json({ questions: mapped });
  } catch (error) {
    logApiError('public/page/questions', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
