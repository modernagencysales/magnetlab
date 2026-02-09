import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transcript, title } = body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 100) {
      return NextResponse.json(
        { error: 'Transcript is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: record, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: session.user.id,
        source: 'paste',
        title: title || 'Pasted Transcript',
        raw_transcript: transcript.trim(),
      })
      .select()
      .single();

    if (insertError || !record) {
      console.error('Failed to insert pasted transcript:', insertError?.message);
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    // Trigger processing
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId: session.user.id,
        transcriptId: record.id,
      });
    } catch (triggerError) {
      console.warn('Failed to trigger process-transcript:', triggerError);
    }

    return NextResponse.json({
      success: true,
      transcript_id: record.id,
    });
  } catch (error) {
    console.error('Transcript paste error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    const { data: transcripts, error } = await supabase
      .from('cp_call_transcripts')
      .select('id, source, title, call_date, duration_minutes, transcript_type, ideas_extracted_at, knowledge_extracted_at, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Failed to fetch transcripts:', error.message);
      return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
    }

    return NextResponse.json({ transcripts: transcripts || [] });
  } catch (error) {
    console.error('Transcripts list error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
