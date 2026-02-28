import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import * as cpTranscriptsService from '@/server/services/cp-transcripts.service';

function parseVTT(raw: string): string {
  const lines = raw.split('\n');
  const textLines: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (
      !trimmed ||
      trimmed === 'WEBVTT' ||
      trimmed.startsWith('NOTE') ||
      /^\d+$/.test(trimmed) ||
      /-->/.test(trimmed)
    ) continue;
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
    if (!trimmed || /^\d+$/.test(trimmed) || /-->/.test(trimmed)) continue;
    const cleaned = trimmed.replace(/<[^>]+>/g, '').trim();
    if (cleaned) textLines.push(cleaned);
  }
  return textLines.join('\n');
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) return ApiErrors.unauthorized();

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = (formData.get('title') as string) || '';

    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const fileName = file.name.toLowerCase();
    const allowedExtensions = ['.txt', '.vtt', '.srt'];
    const ext = allowedExtensions.find((e) => fileName.endsWith(e));
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload .txt, .vtt, or .srt files.' },
        { status: 400 }
      );
    }
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 });
    }

    const raw = await file.text();
    let transcript: string;
    if (ext === '.vtt') transcript = parseVTT(raw);
    else if (ext === '.srt') transcript = parseSRT(raw);
    else transcript = raw.trim();

    if (transcript.length < 100) {
      return NextResponse.json(
        { error: 'Transcript too short after parsing (min 100 characters)' },
        { status: 400 }
      );
    }

    const result = await cpTranscriptsService.createFromUpload(session.user.id, {
      title: title || file.name.replace(/\.(txt|vtt|srt)$/i, ''),
      raw_transcript: transcript,
    });
    if (!result.success) return ApiErrors.databaseError('Failed to save transcript');
    return NextResponse.json({ success: true, transcript_id: result.transcript_id });
  } catch (error) {
    logApiError('cp/transcripts/upload', error);
    return ApiErrors.internalError('Failed to upload transcript');
  }
}
