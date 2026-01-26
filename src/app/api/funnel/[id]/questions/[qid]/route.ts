// API Route: Single Qualification Question
// PUT, DELETE /api/funnel/[id]/questions/[qid]

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import {
  qualificationQuestionFromRow,
  type QualificationQuestionRow,
} from '@/lib/types/funnel';

interface RouteParams {
  params: Promise<{ id: string; qid: string }>;
}

// PUT - Update a question
export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
    }

    // Build update object
    const updateData: Record<string, unknown> = {};

    if (body.questionText !== undefined) {
      updateData.question_text = body.questionText;
    }
    if (body.questionOrder !== undefined) {
      updateData.question_order = body.questionOrder;
    }
    if (body.qualifyingAnswer !== undefined) {
      if (!['yes', 'no'].includes(body.qualifyingAnswer)) {
        return NextResponse.json(
          { error: 'qualifyingAnswer must be "yes" or "no"' },
          { status: 400 }
        );
      }
      updateData.qualifying_answer = body.qualifyingAnswer;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
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
      console.error('Update question error:', error);
      return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 });
    }

    return NextResponse.json({ question: qualificationQuestionFromRow(data as QualificationQuestionRow) });
  } catch (error) {
    console.error('Update question error:', error);
    return NextResponse.json({ error: 'Failed to update question' }, { status: 500 });
  }
}

// DELETE - Delete a question
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
      return NextResponse.json({ error: 'Funnel page not found' }, { status: 404 });
    }

    // Delete question
    const { error } = await supabase
      .from('qualification_questions')
      .delete()
      .eq('id', qid)
      .eq('funnel_page_id', id);

    if (error) {
      console.error('Delete question error:', error);
      return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete question error:', error);
    return NextResponse.json({ error: 'Failed to delete question' }, { status: 500 });
  }
}
