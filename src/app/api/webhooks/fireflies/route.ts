import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';

interface FirefliesWebhookPayload {
  meeting_id: string;
  title?: string;
  date?: string;
  duration_minutes?: number;
  participants?: string[];
  transcript: string;
  user_id: string;
}

export async function POST(request: NextRequest) {
  try {
    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret || secret !== process.env.FIREFLIES_WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload: FirefliesWebhookPayload = await request.json();

    if (!payload.meeting_id || !payload.transcript || !payload.user_id) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting_id, transcript, user_id' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();
    const externalId = `fireflies:${payload.meeting_id}`;

    // Deduplicate
    const { data: existing } = await supabase
      .from('cp_call_transcripts')
      .select('id')
      .eq('external_id', externalId)
      .eq('user_id', payload.user_id)
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
        user_id: payload.user_id,
        source: 'fireflies',
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
      console.error('Failed to insert Fireflies transcript:', insertError?.message);
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId: payload.user_id,
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
    console.error('Fireflies webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
