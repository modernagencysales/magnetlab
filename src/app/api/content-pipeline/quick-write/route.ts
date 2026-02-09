import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { quickWrite } from '@/lib/ai/content-pipeline/quick-writer';

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { raw_thought, template_structure, style_instructions, target_audience } = body;

    if (!raw_thought || typeof raw_thought !== 'string' || raw_thought.trim().length === 0) {
      return NextResponse.json({ error: 'raw_thought is required' }, { status: 400 });
    }

    const result = await quickWrite(raw_thought, {
      templateStructure: template_structure,
      styleInstructions: style_instructions,
      targetAudience: target_audience,
    });

    // Save as a pipeline post
    const supabase = createSupabaseAdminClient();

    const { data: post, error } = await supabase
      .from('cp_pipeline_posts')
      .insert({
        user_id: session.user.id,
        draft_content: result.post.content,
        final_content: result.polish.polished,
        dm_template: result.post.dm_template,
        cta_word: result.post.cta_word,
        variations: result.post.variations,
        status: 'draft',
        hook_score: result.polish.hookScore?.score || null,
        polish_status: 'polished',
        polish_notes: result.polish.changes.join('; '),
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      post,
      synthetic_idea: result.syntheticIdea,
    }, { status: 201 });
  } catch (error) {
    console.error('Quick write error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
