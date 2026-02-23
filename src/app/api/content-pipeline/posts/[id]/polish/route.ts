import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { polishPost } from '@/lib/ai/content-pipeline/post-polish';
import type { TeamVoiceProfile } from '@/lib/types/content-pipeline';

import { logError } from '@/lib/utils/logger';

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

    const { data: post, error: fetchError } = await supabase
      .from('cp_pipeline_posts')
      .select('draft_content, final_content, team_profile_id')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (fetchError || !post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    const content = post.final_content || post.draft_content;
    if (!content) {
      return NextResponse.json({ error: 'No content to polish' }, { status: 400 });
    }

    // Fetch voice profile if the post is associated with a team profile
    let voiceProfile: TeamVoiceProfile | undefined;
    if (post.team_profile_id) {
      const { data: profile } = await supabase
        .from('team_profiles')
        .select('voice_profile')
        .eq('id', post.team_profile_id)
        .single();
      if (profile?.voice_profile) {
        voiceProfile = profile.voice_profile as TeamVoiceProfile;
      }
    }

    const result = await polishPost(content, { voiceProfile });

    const { data: updated, error: updateError } = await supabase
      .from('cp_pipeline_posts')
      .update({
        final_content: result.polished,
        hook_score: result.hookScore.score,
        polish_status: result.changes.length > 0 ? 'polished' : 'skipped',
        polish_notes: result.changes.length > 0 ? result.changes.join('; ') : 'No changes needed',
      })
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select('id')
      .maybeSingle();

    if (updateError) {
      logError('cp/posts/polish', new Error(String(updateError.message)), { step: 'failed_to_update_polished_post' });
      return NextResponse.json({ error: 'Failed to save polish result' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json({ error: 'Post not found or not updated' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      polishResult: {
        aiPatternsFound: result.aiPatternsFound,
        hookScore: result.hookScore,
        changes: result.changes,
      },
    });
  } catch (error) {
    logError('cp/posts/polish', error, { step: 'polish_post_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
