import { task, logger } from '@trigger.dev/sdk/v3';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { writePostFreeform } from '@/lib/ai/content-pipeline/post-writer';
import { buildContentBriefForIdea } from '@/lib/ai/content-pipeline/briefing-agent';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { isEmbeddingsConfigured } from '@/lib/ai/embeddings';

interface WritePostPayload {
  userId: string;
  ideaId: string;
}

export const writePostFromIdea = task({
  id: 'write-post-from-idea',
  maxDuration: 120, // 2 minutes — briefing + write + polish
  retry: { maxAttempts: 2 },
  run: async (payload: WritePostPayload) => {
    const { userId, ideaId } = payload;
    const supabase = createSupabaseAdminClient();

    logger.info('Writing post from idea', { userId, ideaId });

    // Fetch the idea
    const { data: idea, error: ideaError } = await supabase
      .from('cp_content_ideas')
      .select('id, user_id, transcript_id, title, core_insight, why_post_worthy, full_context, content_type, content_pillar, relevance_score, status, created_at, updated_at')
      .eq('id', ideaId)
      .eq('user_id', userId)
      .single();

    if (ideaError || !idea) {
      throw new Error(`Idea not found: ${ideaId}`);
    }

    // Build content brief from AI Brain (if embeddings configured)
    let knowledgeContext: string | undefined;
    if (isEmbeddingsConfigured()) {
      try {
        logger.info('Building content brief');
        const brief = await buildContentBriefForIdea(userId, idea);
        if (brief.compiledContext) {
          knowledgeContext = brief.compiledContext;
        }
      } catch (briefError) {
        logger.warn('Failed to build content brief', { error: String(briefError) });
      }
    }

    // Write the post
    logger.info('Writing post');
    const writtenPost = await writePostFreeform({
      idea: {
        id: idea.id,
        title: idea.title,
        core_insight: idea.core_insight,
        full_context: idea.full_context,
        why_post_worthy: idea.why_post_worthy,
        content_type: idea.content_type,
      },
      knowledgeContext,
    });

    // Polish the post
    logger.info('Polishing post');
    const polishResult = await polishPost(writtenPost.content);

    // Save the pipeline post
    const { error: postError } = await supabase
      .from('cp_pipeline_posts')
      .insert({
        user_id: userId,
        idea_id: ideaId,
        draft_content: writtenPost.content,
        final_content: polishResult.polished,
        dm_template: writtenPost.dm_template,
        cta_word: writtenPost.cta_word,
        variations: writtenPost.variations,
        status: 'draft',
        hook_score: polishResult.hookScore.score,
        polish_status: polishResult.changes.length > 0 ? 'polished' : 'pending',
        polish_notes: polishResult.changes.length > 0 ? polishResult.changes.join('; ') : null,
      });

    if (postError) {
      logger.error('Failed to save pipeline post', { error: postError.message });
      throw new Error(`Failed to save post: ${postError.message}`);
    }

    // Update idea status to written
    await supabase
      .from('cp_content_ideas')
      .update({ status: 'written' })
      .eq('id', ideaId);

    logger.info('Post written successfully', {
      ideaId,
      hookScore: polishResult.hookScore.score,
      polished: polishResult.changes.length > 0,
    });

    return {
      ideaId,
      hookScore: polishResult.hookScore.score,
      changes: polishResult.changes,
    };
  },
});
