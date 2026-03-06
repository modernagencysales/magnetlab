// API Route: External Transcript Ingestion for DFY Content
// POST /api/external/ingest-transcript
//
// Allows gtm-system to push a call transcript into a magnetlab user's
// account and trigger knowledge extraction. Authenticated via Bearer token.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { ApiErrors, logApiError } from '@/lib/api/errors';
import { ingestTranscript } from '@/server/services/external.service';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    logApiError('external/ingest-transcript/auth', new Error('EXTERNAL_API_KEY env var is not set'));
    return false;
  }

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedKey);
  if (tokenBuf.length !== expectedBuf.length) return false;
  return timingSafeEqual(tokenBuf, expectedBuf);
}

export async function POST(request: Request) {
  try {
    if (!authenticateRequest(request)) {
      return NextResponse.json({ error: 'Invalid or missing API key' }, { status: 401 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { user_id, transcript, title, source } = body as {
      user_id?: string;
      transcript?: string;
      title?: string;
      source?: string;
    };

    if (!user_id) {
      return NextResponse.json({ error: 'user_id is required' }, { status: 400 });
    }
    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: 'transcript is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    const result = await ingestTranscript({
      user_id,
      transcript,
      title,
      source,
    });

    if (!result.success) {
      if (result.error === 'team_not_found') {
        return NextResponse.json(
          { error: 'Could not resolve team for user_id' },
          { status: 404 }
        );
      }
      return ApiErrors.internalError('Failed to insert transcript');
    }

    return NextResponse.json(
      { success: true, transcript_id: result.transcript_id },
      { status: 201 }
    );
  } catch (error) {
    logApiError('external/ingest-transcript', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
