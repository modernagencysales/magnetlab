import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';

interface UniversalTranscriptPayload {
  source?: string;
  recording_id: string;
  title?: string;
  date?: string;
  duration_minutes?: number;
  participants?: string[];
  transcript: string;
}

export async function POST(request: NextRequest) {
  try {
    // Auth via webhook secret URL param
    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret || secret !== process.env.TRANSCRIPT_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userId = request.nextUrl.searchParams.get('user_id');
    if (!userId) {
      return NextResponse.json(
        { error: 'Missing required query param: user_id' },
        { status: 400 }
      );
    }

    const payload: UniversalTranscriptPayload = await request.json();

    if (!payload.recording_id || !payload.transcript) {
      return NextResponse.json(
        { error: 'Missing required fields: recording_id, transcript' },
        { status: 400 }
      );
    }

    const source = payload.source || 'other';
    const externalId = `${source}:${payload.recording_id}`;
    const supabase = createSupabaseAdminClient();

    // Deduplicate
    const { data: existing } = await supabase
      .from('cp_call_transcripts')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({
        success: true,
        duplicate: true,
        transcript_id: existing.id,
      });
    }

    // Insert
    const { data: transcript, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: userId,
        source,
        external_id: externalId,
        title: payload.title || null,
        call_date: payload.date || null,
        duration_minutes: payload.duration_minutes || null,
        participants: payload.participants || null,
        raw_transcript: payload.transcript,
      })
      .select()
      .single();

    if (insertError || !transcript) {
      console.error('Failed to insert transcript:', insertError?.message);
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    // Trigger processing
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId,
        transcriptId: transcript.id,
      });
    } catch (triggerError) {
      console.warn('Failed to trigger process-transcript:', triggerError);
    }

    return NextResponse.json({
      success: true,
      transcript_id: transcript.id,
    });
  } catch (error) {
    console.error('Universal transcript webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
