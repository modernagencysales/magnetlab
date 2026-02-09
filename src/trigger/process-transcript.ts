import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { classifyTranscript } from '@/lib/ai/content-pipeline/transcript-classifier';
import { extractKnowledgeFromTranscript } from '@/lib/ai/content-pipeline/knowledge-extractor';
import { extractIdeasFromTranscript } from '@/lib/ai/content-pipeline/content-extractor';
import { generateEmbedding } from '@/lib/ai/embeddings';

interface ProcessTranscriptPayload {
  userId: string;
  transcriptId: string;
}

export const processTranscript = task({
  id: 'process-transcript',
  maxDuration: 300,
  retry: { maxAttempts: 2 },
  run: async (payload: ProcessTranscriptPayload) => {
    const { userId, transcriptId } = payload;
    const supabase = createSupabaseAdminClient();

    logger.info('Processing transcript', { userId, transcriptId });

    // Fetch transcript
    const { data: transcript, error: fetchError } = await supabase
      .from('cp_call_transcripts')
      .select('*')
      .eq('id', transcriptId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }

    // Step 1: Classify transcript type
    logger.info('Step 1: Classifying transcript');
    const transcriptType = await classifyTranscript(transcript.raw_transcript);

    await supabase
      .from('cp_call_transcripts')
      .update({ transcript_type: transcriptType })
      .eq('id', transcriptId);

    logger.info('Classified transcript', { transcriptType });

    // Step 2: Extract knowledge entries
    logger.info('Step 2: Extracting knowledge');
    const knowledgeResult = await extractKnowledgeFromTranscript(
      transcript.raw_transcript,
      transcriptType,
      {
        callTitle: transcript.title,
        participants: transcript.participants,
        callDate: transcript.call_date,
      }
    );

    logger.info('Extracted knowledge entries', { count: knowledgeResult.total_count });

    // Step 3: Generate embeddings for knowledge entries + save
    logger.info('Step 3: Generating embeddings and saving knowledge');
    const knowledgeInserts = [];
    const tagCounts = new Map<string, number>();

    for (const entry of knowledgeResult.entries) {
      let embedding: number[] | null = null;
      try {
        embedding = await generateEmbedding(
          `${entry.category}: ${entry.content}\nContext: ${entry.context || ''}`
        );
      } catch (embeddingError) {
        logger.warn('Failed to generate embedding for knowledge entry', {
          error: embeddingError instanceof Error ? embeddingError.message : String(embeddingError),
        });
      }

      knowledgeInserts.push({
        user_id: userId,
        transcript_id: transcriptId,
        category: entry.category,
        speaker: entry.speaker,
        content: entry.content,
        context: entry.context,
        tags: entry.tags,
        transcript_type: transcriptType,
        embedding: embedding ? JSON.stringify(embedding) : null,
      });

      // Track tag usage
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
    }

    if (knowledgeInserts.length > 0) {
      const { error: knowledgeError } = await supabase
        .from('cp_knowledge_entries')
        .insert(knowledgeInserts);

      if (knowledgeError) {
        logger.error('Failed to insert knowledge entries', {
          error: knowledgeError.message,
        });
      }
    }

    // Update knowledge tags
    for (const [tagName, count] of tagCounts) {
      const { error: tagError } = await supabase
        .from('cp_knowledge_tags')
        .upsert(
          { user_id: userId, tag_name: tagName, usage_count: count },
          { onConflict: 'user_id,tag_name' }
        );

      if (tagError) {
        logger.warn('Failed to upsert tag', { tagName, error: tagError.message });
      }
    }

    // Mark knowledge extracted
    await supabase
      .from('cp_call_transcripts')
      .update({ knowledge_extracted_at: new Date().toISOString() })
      .eq('id', transcriptId);

    // Step 4: Extract content ideas
    logger.info('Step 4: Extracting content ideas');
    const ideasResult = await extractIdeasFromTranscript(
      transcript.raw_transcript,
      {
        callTitle: transcript.title,
        participants: transcript.participants,
        callDate: transcript.call_date,
      }
    );

    logger.info('Extracted content ideas', {
      count: ideasResult.total_count,
      postReady: ideasResult.post_ready_count,
    });

    // Save ideas
    if (ideasResult.ideas.length > 0) {
      const ideaInserts = ideasResult.ideas.map((idea) => ({
        user_id: userId,
        transcript_id: transcriptId,
        title: idea.title,
        core_insight: idea.core_insight,
        full_context: idea.full_context,
        why_post_worthy: idea.why_post_worthy,
        post_ready: idea.post_ready,
        content_type: idea.content_type,
        content_pillar: idea.content_pillar,
        status: 'extracted',
      }));

      const { error: ideasError } = await supabase
        .from('cp_content_ideas')
        .insert(ideaInserts);

      if (ideasError) {
        logger.error('Failed to insert content ideas', {
          error: ideasError.message,
        });
      }
    }

    // Mark ideas extracted
    await supabase
      .from('cp_call_transcripts')
      .update({ ideas_extracted_at: new Date().toISOString() })
      .eq('id', transcriptId);

    logger.info('Transcript processing complete', {
      transcriptId,
      knowledgeEntries: knowledgeResult.total_count,
      contentIdeas: ideasResult.total_count,
      postReadyIdeas: ideasResult.post_ready_count,
    });

    return {
      transcriptId,
      transcriptType,
      knowledgeEntries: knowledgeResult.total_count,
      contentIdeas: ideasResult.total_count,
      postReadyIdeas: ideasResult.post_ready_count,
    };
  },
});
