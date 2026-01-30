// API Route: Public - Get qualification questions for a funnel page
// GET /api/public/questions/[id]

import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logApiError } from '@/lib/api/errors';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id: funnelPageId } = await params;
    const supabase = createSupabaseAdminClient();

    // Verify page exists and is published
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id, is_published')
      .eq('id', funnelPageId)
      .single();

    if (funnelError || !funnel || !funnel.is_published) {
      return NextResponse.json({ error: 'Page not found' }, { status: 404 });
    }

    // Get questions
    const { data: questions, error: questionsError } = await supabase
      .from('qualification_questions')
      .select('id, question_text, question_order, answer_type, options, placeholder, is_required')
      .eq('funnel_page_id', funnelPageId)
      .order('question_order', { ascending: true });

    if (questionsError) {
      logApiError('public/page/questions', questionsError, { funnelPageId });
      return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 });
    }

    // Map to camelCase for client
    const mapped = (questions || []).map((q) => ({
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
