import { schedules, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { extractIdeasFromTranscript } from '@/lib/ai/content-pipeline/content-extractor';
import { extractKnowledgeFromTranscript } from '@/lib/ai/content-pipeline/knowledge-extractor';
import { classifyTranscript } from '@/lib/ai/content-pipeline/transcript-classifier';
import { generateEmbedding } from '@/lib/ai/embeddings';
import { runNightlyBatch } from '@/lib/services/autopilot';
import type { TranscriptType } from '@/lib/types/content-pipeline';

export const nightlyAutopilotBatch = schedules.task({
  id: 'nightly-autopilot-batch',
  cron: '0 2 * * *', // 2 AM UTC daily
  maxDuration: 600,
  run: async () => {
    const supabase = createSupabaseAdminClient();

    logger.info('Starting nightly autopilot batch');

    // Find all users with active posting slots
    const { data: activeSlots } = await supabase
      .from('cp_posting_slots')
      .select('user_id')
      .eq('is_active', true);

    const userIds = [...new Set(activeSlots?.map((s) => s.user_id) || [])];

    if (userIds.length === 0) {
      logger.info('No users with active posting slots');
      return { usersProcessed: 0 };
    }

    logger.info('Processing users', { count: userIds.length });

    const results = [];

    for (const userId of userIds) {
      try {
        logger.info('Processing user', { userId });

        // Step 1: Process unprocessed transcripts
        const { data: newTranscripts } = await supabase
          .from('cp_call_transcripts')
          .select('*')
          .eq('user_id', userId)
          .is('ideas_extracted_at', null)
          .order('created_at', { ascending: true })
          .limit(5);

        if (newTranscripts?.length) {
          logger.info('Processing new transcripts', { count: newTranscripts.length, userId });

          for (const transcript of newTranscripts) {
            try {
              // Classify if not already done
              let transcriptType: TranscriptType = transcript.transcript_type || 'coaching';
              if (!transcript.transcript_type) {
                transcriptType = await classifyTranscript(transcript.raw_transcript);
                await supabase
                  .from('cp_call_transcripts')
                  .update({ transcript_type: transcriptType })
                  .eq('id', transcript.id);
              }

              // Extract knowledge if not done
              if (!transcript.knowledge_extracted_at) {
                const knowledgeResult = await extractKnowledgeFromTranscript(
                  transcript.raw_transcript,
                  transcriptType,
                  {
                    callTitle: transcript.title,
                    participants: transcript.participants,
                    callDate: transcript.call_date,
                  }
                );

                // Save knowledge entries with embeddings
                for (const entry of knowledgeResult.entries) {
                  let embedding: number[] | null = null;
                  try {
                    embedding = await generateEmbedding(
                      `${entry.category}: ${entry.content}\nContext: ${entry.context || ''}`
                    );
                  } catch {
                    // Continue without embedding
                  }

                  await supabase.from('cp_knowledge_entries').insert({
                    user_id: userId,
                    transcript_id: transcript.id,
                    category: entry.category,
                    speaker: entry.speaker,
                    content: entry.content,
                    context: entry.context,
                    tags: entry.tags,
                    transcript_type: transcriptType,
                    embedding: embedding ? JSON.stringify(embedding) : null,
                  });

                  // Update tags
                  for (const tag of entry.tags) {
                    await supabase
                      .from('cp_knowledge_tags')
                      .upsert(
                        { user_id: userId, tag_name: tag, usage_count: 1 },
                        { onConflict: 'user_id,tag_name' }
                      );
                  }
                }

                await supabase
                  .from('cp_call_transcripts')
                  .update({ knowledge_extracted_at: new Date().toISOString() })
                  .eq('id', transcript.id);
              }

              // Extract content ideas
              const ideasResult = await extractIdeasFromTranscript(
                transcript.raw_transcript,
                {
                  callTitle: transcript.title,
                  participants: transcript.participants,
                  callDate: transcript.call_date,
                }
              );

              if (ideasResult.ideas.length > 0) {
                await supabase.from('cp_content_ideas').insert(
                  ideasResult.ideas.map((idea) => ({
                    user_id: userId,
                    transcript_id: transcript.id,
                    title: idea.title,
                    core_insight: idea.core_insight,
                    full_context: idea.full_context,
                    why_post_worthy: idea.why_post_worthy,
                    post_ready: idea.post_ready,
                    content_type: idea.content_type,
                    content_pillar: idea.content_pillar,
                    status: 'extracted',
                  }))
                );
              }

              await supabase
                .from('cp_call_transcripts')
                .update({ ideas_extracted_at: new Date().toISOString() })
                .eq('id', transcript.id);

              logger.info('Processed transcript', {
                transcriptId: transcript.id,
                ideas: ideasResult.total_count,
              });
            } catch (transcriptError) {
              logger.error('Failed to process transcript', {
                transcriptId: transcript.id,
                error: transcriptError instanceof Error ? transcriptError.message : String(transcriptError),
              });
            }
          }
        }

        // Step 2: Run autopilot batch
        const batchResult = await runNightlyBatch({
          userId,
          postsPerBatch: 3,
          bufferTarget: 5,
          autoPublish: false,
          autoPublishDelayHours: 24,
        });

        results.push({
          userId,
          transcriptsProcessed: newTranscripts?.length || 0,
          ...batchResult,
        });

        logger.info('User batch complete', {
          userId,
          postsCreated: batchResult.postsCreated,
          postsScheduled: batchResult.postsScheduled,
        });
      } catch (userError) {
        logger.error('Failed to process user', {
          userId,
          error: userError instanceof Error ? userError.message : String(userError),
        });
        results.push({ userId, error: String(userError) });
      }
    }

    logger.info('Nightly batch complete', {
      usersProcessed: userIds.length,
      totalPostsCreated: results.reduce((sum, r) => sum + ((r as { postsCreated?: number }).postsCreated || 0), 0),
    });

    return { usersProcessed: userIds.length, results };
  },
});
