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
  maxDuration: 600, // 10 minutes — 4 sequential AI calls + embedding batches
  retry: { maxAttempts: 2 },
  run: async (payload: ProcessTranscriptPayload) => {
    const { userId, transcriptId } = payload;
    const supabase = createSupabaseAdminClient();

    logger.info('Processing transcript', { userId, transcriptId });

    // Fetch transcript
    const { data: transcript, error: fetchError } = await supabase
      .from('cp_call_transcripts')
      .select('id, user_id, source, external_id, title, call_date, duration_minutes, participants, raw_transcript, summary, extracted_topics, transcript_type, ideas_extracted_at, knowledge_extracted_at, created_at')
      .eq('id', transcriptId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !transcript) {
      throw new Error(`Transcript not found: ${transcriptId}`);
    }

    // Duplicate prevention: skip if already fully processed
    if (transcript.knowledge_extracted_at && transcript.ideas_extracted_at) {
      logger.info('Transcript already processed, skipping', { transcriptId });
      return {
        transcriptId,
        transcriptType: transcript.transcript_type,
        knowledgeEntries: 0,
        contentIdeas: 0,
        postReadyIdeas: 0,
        skipped: true,
      };
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

    // Step 3: Generate embeddings in parallel + save knowledge
    logger.info('Step 3: Generating embeddings and saving knowledge');
    const tagCounts = new Map<string, number>();

    // Generate all embeddings in parallel (batches of 5 to avoid rate limits)
    const embeddingTexts = knowledgeResult.entries.map(
      (entry) => `${entry.category}: ${entry.content}\nContext: ${entry.context || ''}`
    );
    const embeddings: (number[] | null)[] = [];
    const BATCH_SIZE = 5;

    for (let i = 0; i < embeddingTexts.length; i += BATCH_SIZE) {
      const batch = embeddingTexts.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(batch.map((text) => generateEmbedding(text)));
      for (const result of results) {
        embeddings.push(result.status === 'fulfilled' ? result.value : null);
      }
    }

    const knowledgeInserts = knowledgeResult.entries.map((entry, idx) => {
      for (const tag of entry.tags) {
        tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
      }
      return {
        user_id: userId,
        transcript_id: transcriptId,
        category: entry.category,
        speaker: entry.speaker,
        content: entry.content,
        context: entry.context,
        tags: entry.tags,
        transcript_type: transcriptType,
        embedding: embeddings[idx] ? JSON.stringify(embeddings[idx]) : null,
      };
    });

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

    // Increment tag counts atomically via RPC (parallel)
    await Promise.allSettled(
      Array.from(tagCounts).map(([tagName, count]) =>
        supabase.rpc('cp_increment_tag_count', {
          p_user_id: userId,
          p_tag_name: tagName,
          p_count: count,
        }).then(({ error }) => {
          if (error) logger.warn('Failed to increment tag', { tagName, error: error.message });
        })
      )
    );

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
