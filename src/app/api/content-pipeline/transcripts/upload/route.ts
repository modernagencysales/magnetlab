import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';

function parseVTT(raw: string): string {
  const lines = raw.split('\n');
  const textLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip WEBVTT header, empty lines, cue identifiers, and timestamp lines
    if (
      !trimmed ||
      trimmed === 'WEBVTT' ||
      trimmed.startsWith('NOTE') ||
      /^\d+$/.test(trimmed) ||
      /-->/.test(trimmed)
    ) {
      continue;
    }
    // Strip inline VTT tags like <v Speaker Name>
    const cleaned = trimmed.replace(/<[^>]+>/g, '').trim();
    if (cleaned) textLines.push(cleaned);
  }
  return textLines.join('\n');
}

function parseSRT(raw: string): string {
  const lines = raw.split('\n');
  const textLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines, sequence numbers, and timestamp lines
    if (!trimmed || /^\d+$/.test(trimmed) || /-->/.test(trimmed)) {
      continue;
    }
    // Strip HTML-like tags
    const cleaned = trimmed.replace(/<[^>]+>/g, '').trim();
    if (cleaned) textLines.push(cleaned);
  }
  return textLines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.txt', '.vtt', '.srt'];
    const ext = allowedExtensions.find((e) => fileName.endsWith(e));
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload .txt, .vtt, or .srt files.' },
        { status: 400 }
      );
    }

    // 10MB limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const raw = await file.text();

    // Parse based on file type
    let transcript: string;
    if (ext === '.vtt') {
      transcript = parseVTT(raw);
    } else if (ext === '.srt') {
      transcript = parseSRT(raw);
    } else {
      transcript = raw.trim();
    }

    if (transcript.length < 100) {
      return NextResponse.json(
        { error: 'Transcript too short after parsing (min 100 characters)' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    const { data: record, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: session.user.id,
        source: 'upload',
        title: title || file.name.replace(/\.(txt|vtt|srt)$/i, ''),
        raw_transcript: transcript,
      })
      .select()
      .single();

    if (insertError || !record) {
      console.error('Failed to insert uploaded transcript:', insertError?.message);
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
    console.error('Transcript upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
