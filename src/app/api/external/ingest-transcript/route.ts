// API Route: External Transcript Ingestion for DFY Content
// POST /api/external/ingest-transcript
//
// Allows gtm-system to push a call transcript into a magnetlab user's
// account and trigger knowledge extraction. Authenticated via Bearer token.

import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';

function authenticateRequest(request: Request): boolean {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;

  const token = authHeader.slice(7);
  const expectedKey = process.env.EXTERNAL_API_KEY;

  if (!expectedKey) {
    console.error('[external/ingest-transcript] EXTERNAL_API_KEY env var is not set');
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
      return NextResponse.json(
        { error: 'Invalid or missing API key' },
        { status: 401 }
      );
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { user_id, transcript, title, source } = body as {
      user_id?: string;
      transcript?: string;
      title?: string;
      source?: string;
    };

    // Validate required fields
    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id is required' },
        { status: 400 }
      );
    }

    if (!transcript || transcript.length < 100) {
      return NextResponse.json(
        { error: 'transcript is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Resolve the user's team_id
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id')
      .eq('owner_id', user_id)
      .limit(1)
      .single();

    if (teamError || !team) {
      console.error('[external/ingest-transcript] Failed to resolve team for user', user_id, teamError);
      return NextResponse.json(
        { error: 'Could not resolve team for user_id' },
        { status: 404 }
      );
    }

    const teamId = team.id;

    // Insert transcript record
    const { data: record, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id,
        source: source || 'dfy_content_call',
        title: title || 'Content Call',
        raw_transcript: transcript,
        team_id: teamId,
      })
      .select('id')
      .single();

    if (insertError || !record) {
      console.error('[external/ingest-transcript] Failed to insert transcript', insertError);
      return NextResponse.json(
        { error: 'Failed to insert transcript' },
        { status: 500 }
      );
    }

    // Trigger the process-transcript task
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId: user_id,
        transcriptId: record.id,
        teamId,
      });
    } catch (triggerError) {
      console.error('[external/ingest-transcript] Failed to trigger process-transcript task', triggerError);
      // Transcript is saved — don't fail the request, but log the error
    }

    return NextResponse.json(
      { success: true, transcript_id: record.id },
      { status: 201 }
    );
  } catch (error) {
    console.error('[external/ingest-transcript] Unexpected error', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
