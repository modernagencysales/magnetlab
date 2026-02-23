import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';

import { logError, logWarn } from '@/lib/utils/logger';

interface FathomWebhookPayload {
  call_id?: string;
  id?: string;
  meeting_id?: string;
  title?: string;
  date?: string;
  duration?: number; // seconds (Fathom sends seconds)
  duration_minutes?: number;
  participants?: string[];
  transcript?: string;
  transcript_text?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    // 1. Auth via webhook secret URL param
    const secret = request.nextUrl.searchParams.get('secret');
    if (!secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createSupabaseAdminClient();

    // 2. Look up stored webhook_secret for this user + service
    const { data: integration, error: integrationError } = await supabase
      .from('user_integrations')
      .select('webhook_secret, is_active')
      .eq('user_id', userId)
      .eq('service', 'fathom')
      .single();

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 3. Compare secrets
    if (secret !== integration.webhook_secret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 4. Parse payload
    const payload: FathomWebhookPayload = await request.json();

    // 5. Extract meeting ID (Fathom may use different field names)
    const meetingId = payload.call_id || payload.id || payload.meeting_id;

    // 6. Extract transcript (Fathom may use different field names)
    const transcriptText = payload.transcript || payload.transcript_text;

    // 7. Validate required fields
    if (!meetingId || !transcriptText) {
      return NextResponse.json(
        { error: 'Missing required fields: meeting ID and transcript' },
        { status: 400 }
      );
    }

    // 8. Skip very short transcripts (not meaningful)
    if (transcriptText.length < 100) {
      logWarn('webhooks/fathom', 'Skipping short transcript', {
        userId,
        meetingId,
        length: transcriptText.length,
      });
      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Transcript too short (< 100 chars)',
      });
    }

    const externalId = `fathom:${meetingId}`;

    // 9. Deduplicate
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

    // 10. Normalize duration to minutes
    let durationMinutes: number | null = null;
    if (payload.duration_minutes) {
      durationMinutes = payload.duration_minutes;
    } else if (payload.duration) {
      durationMinutes = Math.round(payload.duration / 60);
    }

    // 11. Insert transcript
    const { data: transcript, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: userId,
        source: 'fathom',
        external_id: externalId,
        title: payload.title || null,
        call_date: payload.date || null,
        duration_minutes: durationMinutes,
        participants: payload.participants || null,
        raw_transcript: transcriptText,
      })
      .select()
      .single();

    if (insertError || !transcript) {
      logError('webhooks/fathom', new Error(String(insertError?.message)), {
        step: 'failed_to_insert_fathom_transcript',
        userId,
        meetingId,
      });
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    // 12. Trigger processing (fire-and-forget)
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId,
        transcriptId: transcript.id,
      });
    } catch (triggerError) {
      logWarn('webhooks/fathom', 'Failed to trigger process-transcript', {
        detail: String(triggerError),
        userId,
        transcriptId: transcript.id,
      });
    }

    // 13. Return success
    return NextResponse.json({
      success: true,
      transcript_id: transcript.id,
    });
  } catch (error) {
    logError('webhooks/fathom', error, { step: 'fathom_webhook_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
