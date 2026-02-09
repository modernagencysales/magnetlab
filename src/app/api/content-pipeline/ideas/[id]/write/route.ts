import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { writePostFreeform } from '@/lib/ai/content-pipeline/post-writer';
import { buildContentBriefForIdea } from '@/lib/ai/content-pipeline/briefing-agent';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import { isEmbeddingsConfigured } from '@/lib/ai/embeddings';

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

    // Fetch the idea
    const { data: idea, error: ideaError } = await supabase
      .from('cp_content_ideas')
      .select('*')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (ideaError || !idea) {
      return NextResponse.json({ error: 'Idea not found' }, { status: 404 });
    }

    // Update idea status
    await supabase
      .from('cp_content_ideas')
      .update({ status: 'writing' })
      .eq('id', id);

    // Build content brief from AI Brain (if embeddings configured)
    let knowledgeContext: string | undefined;
    if (isEmbeddingsConfigured()) {
      try {
        const brief = await buildContentBriefForIdea(session.user.id, idea);
        if (brief.compiledContext) {
          knowledgeContext = brief.compiledContext;
        }
      } catch (briefError) {
        console.warn('Failed to build content brief:', briefError);
      }
    }

    // Write the post
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
    const polishResult = await polishPost(writtenPost.content);

    // Save the pipeline post
    const { data: post, error: postError } = await supabase
      .from('cp_pipeline_posts')
      .insert({
        user_id: session.user.id,
        idea_id: id,
        draft_content: writtenPost.content,
        final_content: polishResult.polished,
        dm_template: writtenPost.dm_template,
        cta_word: writtenPost.cta_word,
        variations: writtenPost.variations,
        status: 'draft',
        hook_score: polishResult.hookScore.score,
        polish_status: polishResult.changes.length > 0 ? 'polished' : 'pending',
        polish_notes: polishResult.changes.length > 0 ? polishResult.changes.join('; ') : null,
      })
      .select()
      .single();

    if (postError) {
      console.error('Failed to save pipeline post:', postError.message);
      return NextResponse.json({ error: 'Failed to save post' }, { status: 500 });
    }

    // Update idea status
    await supabase
      .from('cp_content_ideas')
      .update({ status: 'written' })
      .eq('id', id);

    return NextResponse.json({
      success: true,
      post,
      polishResult: {
        aiPatternsFound: polishResult.aiPatternsFound,
        hookScore: polishResult.hookScore,
        changes: polishResult.changes,
      },
    });
  } catch (error) {
    console.error('Write post from idea error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
