import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { tasks } from '@trigger.dev/sdk/v3';
import type { processTranscript } from '@/trigger/process-transcript';
import { logError, logInfo, logWarn } from '@/lib/utils/logger';

export async function POST(
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

    // Verify transcript exists and belongs to user
    const { data: transcript, error: fetchError } = await supabase
      .from('cp_call_transcripts')
      .select('id, user_id, knowledge_extracted_at, ideas_extracted_at, team_id, speaker_profile_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !transcript) {
      return NextResponse.json({ error: 'Transcript not found' }, { status: 404 });
    }

    // Prevent double-trigger: check if currently processing (timestamps null = currently processing)
    if (!transcript.knowledge_extracted_at && !transcript.ideas_extracted_at) {
      return NextResponse.json({ error: 'Transcript is currently being processed' }, { status: 409 });
    }

    logInfo('cp/transcripts/reprocess', 'Starting reprocess', { transcriptId: id });

    // 1. Fetch existing knowledge entries to compute tag decrements
    const { data: existingEntries } = await supabase
      .from('cp_knowledge_entries')
      .select('id, tags')
      .eq('transcript_id', id);

    // 2. Compute tag counts to decrement
    const tagCounts = new Map<string, number>();
    for (const entry of existingEntries || []) {
      for (const tag of (entry.tags || [])) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    // 3. Delete existing knowledge entries
    const { error: deleteKnowledgeError } = await supabase
      .from('cp_knowledge_entries')
      .delete()
      .eq('transcript_id', id);

    if (deleteKnowledgeError) {
      logError('cp/transcripts/reprocess', new Error('Failed to delete knowledge entries'), {
        detail: deleteKnowledgeError.message,
      });
    }

    // 4. Delete existing content ideas
    const { error: deleteIdeasError } = await supabase
      .from('cp_content_ideas')
      .delete()
      .eq('transcript_id', id);

    if (deleteIdeasError) {
      logError('cp/transcripts/reprocess', new Error('Failed to delete content ideas'), {
        detail: deleteIdeasError.message,
      });
    }

    // 5. Decrement tag counts
    await Promise.allSettled(
      Array.from(tagCounts).map(([tagName, count]) =>
        supabase.rpc('cp_decrement_tag_count', {
          p_user_id: session.user.id,
          p_tag_name: tagName,
          p_count: count,
        })
      )
    );

    // 6. Reset extraction timestamps
    await supabase
      .from('cp_call_transcripts')
      .update({
        knowledge_extracted_at: null,
        ideas_extracted_at: null,
      })
      .eq('id', id);

    // 7. Trigger process-transcript
    try {
      await tasks.trigger<typeof processTranscript>('process-transcript', {
        userId: session.user.id,
        transcriptId: id,
        teamId: transcript.team_id || undefined,
        speakerProfileId: transcript.speaker_profile_id || undefined,
      });
    } catch (triggerError) {
      logWarn('cp/transcripts/reprocess', 'Failed to trigger process-transcript', {
        error: String(triggerError),
      });
    }

    logInfo('cp/transcripts/reprocess', 'Reprocess triggered', {
      transcriptId: id,
      deletedEntries: existingEntries?.length || 0,
      decrementedTags: tagCounts.size,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/transcripts/reprocess', error, { step: 'reprocess_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
