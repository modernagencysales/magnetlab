// API Route: Qualification Questions
// GET, POST /api/funnel/[id]/questions

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  qualificationQuestionFromRow,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET - List all questions for a funnel
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
    }

    // Get questions
    const { data, error } = await supabase
      .from('qualification_questions')
      .select('*')
      .eq('funnel_page_id', id)
      .order('question_order', { ascending: true });

    if (error) {
      console.error('Get questions error:', error);
      return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
    }

    const questions = (data as QualificationQuestionRow[]).map(qualificationQuestionFromRow);

    return NextResponse.json({ questions });
  } catch (error) {
    console.error('Get questions error:', error);
    return NextResponse.json({ error: 'Failed to fetch questions' }, { status: 500 });
  }
}

// POST - Create a new question
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Validate required fields
    if (!body.questionText) {
      return NextResponse.json(
        { error: 'questionText is required' },
        { status: 400 }
      );
    }

    if (!body.qualifyingAnswer || !['yes', 'no'].includes(body.qualifyingAnswer)) {
      return NextResponse.json(
        { error: 'qualifyingAnswer must be "yes" or "no"' },
        { status: 400 }
      );
    }

    // Verify funnel ownership
    const { data: funnel, error: funnelError } = await supabase
      .from('funnel_pages')
      .select('id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (funnelError || !funnel) {
      return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
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
        qualifying_answer: body.qualifyingAnswer,
      })
      .select()
      .single();

    if (error) {
      console.error('Create question error:', error);
      return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
    }

    return NextResponse.json(
      { question: qualificationQuestionFromRow(data as QualificationQuestionRow) },
      { status: 201 }
    );
  } catch (error) {
    console.error('Create question error:', error);
    return NextResponse.json({ error: 'Failed to create question' }, { status: 500 });
  }
}
