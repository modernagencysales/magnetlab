import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { logError } from '@/lib/utils/logger';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const supabase = createSupabaseAdminClient();

    const { data: transcript, error } = await supabase
      .from('cp_call_transcripts')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    // Get counts of related entries
    const [{ count: knowledgeCount }, { count: ideasCount }] = await Promise.all([
      supabase
        .from('cp_knowledge_entries')
        .select('id', { count: 'exact', head: true })
        .eq('transcript_id', id),
      supabase
        .from('cp_content_ideas')
        .select('id', { count: 'exact', head: true })
        .eq('transcript_id', id),
    ]);

    // Resolve speaker profile name
    let speakerName: string | null = null;
    if (transcript.speaker_profile_id) {
      const { data: profile } = await supabase
        .from('team_profiles')
        .select('full_name')
        .eq('id', transcript.speaker_profile_id)
        .single();
      speakerName = profile?.full_name || null;
    }

    return NextResponse.json({
      transcript: {
        ...transcript,
        speaker_name: speakerName,
        knowledge_count: knowledgeCount || 0,
        ideas_count: ideasCount || 0,
      },
    });
  } catch (error) {
    logError('cp/transcripts', error, { step: 'transcript_get_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const supabase = createSupabaseAdminClient();

    // Whitelist allowed fields
    const ALLOWED_FIELDS = ['title', 'call_date', 'participants', 'duration_minutes', 'transcript_type', 'speaker_map'] as const;
    const filtered: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in body) {
        filtered[key] = body[key];
      }
    }

    if (Object.keys(filtered).length === 0) {
      return NextResponse.json({ error: 'No valid fields provided' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('cp_call_transcripts')
      .update(filtered)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ transcript: data });
  } catch (error) {
    logError('cp/transcripts', error, { step: 'transcript_update_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
