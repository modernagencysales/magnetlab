import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import { logError, logWarn } from '@/lib/utils/logger';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { transcript, title, speakerProfileId } = body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length < 100) {
      return NextResponse.json(
        { error: 'Transcript is required and must be at least 100 characters' },
        { status: 400 }
      );
    }

    const supabase = createSupabaseAdminClient();

    // Resolve team_id from the speaker profile or user's team
    let teamId: string | null = null;
    if (speakerProfileId) {
      const { data: profile } = await supabase
        .from('team_profiles')
        .select('team_id')
        .eq('id', speakerProfileId)
        .single();
      teamId = profile?.team_id || null;
    } else {
      const { data: team } = await supabase
        .from('teams')
        .select('id')
        .eq('owner_id', session.user.id)
        .single();
      teamId = team?.id || null;
    }

    const { data: record, error: insertError } = await supabase
      .from('cp_call_transcripts')
      .insert({
        user_id: session.user.id,
        source: 'paste',
        title: title || 'Pasted Transcript',
        raw_transcript: transcript.trim(),
        team_id: teamId,
        speaker_profile_id: speakerProfileId || null,
      })
      .select()
      .single();

    if (insertError || !record) {
      logError('cp/transcripts', new Error('Failed to insert pasted transcript'), { detail: insertError?.message });
      return NextResponse.json({ error: 'Failed to save transcript' }, { status: 500 });
    }

    // Trigger processing
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId: session.user.id,
        transcriptId: record.id,
        teamId: teamId || undefined,
        speakerProfileId: speakerProfileId || undefined,
      });
    } catch (triggerError) {
      logWarn('cp/transcripts', 'Failed to trigger process-transcript', { error: String(triggerError) });
    }

    return NextResponse.json({
      success: true,
      transcript_id: record.id,
    });
  } catch (error) {
    logError('cp/transcripts', error, { action: 'paste' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Transcript id required' }, { status: 400 });
    }

    const supabase = createSupabaseAdminClient();

    // Delete transcript (CASCADE will clean up knowledge entries + ideas via FK)
    const { error } = await supabase
      .from('cp_call_transcripts')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      logError('cp/transcripts', new Error('Failed to delete transcript'), { detail: error.message });
      return NextResponse.json({ error: 'Failed to delete transcript' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/transcripts', error, { action: 'delete' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const speakerProfileId = request.nextUrl.searchParams.get('speaker_profile_id');
    const supabase = createSupabaseAdminClient();

    let query = supabase
      .from('cp_call_transcripts')
      .select('id, source, title, call_date, duration_minutes, transcript_type, ideas_extracted_at, knowledge_extracted_at, team_id, speaker_profile_id, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (speakerProfileId) {
      query = query.eq('speaker_profile_id', speakerProfileId);
    }

    const { data: transcripts, error } = await query;

    if (error) {
      logError('cp/transcripts', new Error('Failed to fetch transcripts'), { detail: error.message });
      return NextResponse.json({ error: 'Failed to fetch transcripts' }, { status: 500 });
    }

    // Enrich with speaker profile names
    const items = transcripts || [];
    const profileIds = [...new Set(items.map(t => t.speaker_profile_id).filter(Boolean))] as string[];
    let profileMap: Record<string, string> = {};

    if (profileIds.length > 0) {
      const { data: profiles } = await supabase
        .from('team_profiles')
        .select('id, full_name')
        .in('id', profileIds);
      if (profiles) {
        profileMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name]));
      }
    }

    const enriched = items.map(t => ({
      ...t,
      speaker_name: t.speaker_profile_id ? profileMap[t.speaker_profile_id] || null : null,
    }));

    return NextResponse.json({ transcripts: enriched });
  } catch (error) {
    logError('cp/transcripts', error, { action: 'list' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
