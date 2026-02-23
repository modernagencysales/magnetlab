import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { createSupabaseAdminClient } from '@/lib/utils/supabase-server';
import { captureEdit } from '@/lib/services/edit-capture';
import { requireTeamScope } from '@/lib/utils/team-context';

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

    const { data, error } = await supabase
      .from('cp_pipeline_posts')
      .select('id, user_id, idea_id, template_id, style_id, draft_content, final_content, dm_template, cta_word, variations, status, hook_score, polish_status, polish_notes, scheduled_time, auto_publish_after, is_buffer, buffer_position, linkedin_post_id, publish_provider, lead_magnet_id, published_at, engagement_stats, scrape_engagement, heyreach_campaign_id, last_engagement_scrape_at, engagement_scrape_count, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', session.user.id)
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    logError('cp/posts', error, { step: 'post_fetch_error' });
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

    // Only allow safe fields to be updated
    const allowedFields = [
      'draft_content', 'final_content', 'dm_template', 'cta_word',
      'status', 'scheduled_time', 'is_buffer', 'buffer_position',
      'scrape_engagement', 'heyreach_campaign_id',
    ];
    const VALID_POST_STATUSES = ['draft', 'reviewing', 'approved', 'scheduled', 'published', 'failed', 'publish_failed'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (field in body) {
        if (field === 'status' && !VALID_POST_STATUSES.includes(body[field])) {
          return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
        }
        updates[field] = body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Fetch current post for edit diff comparison (before the update)
    const hasTextChanges = 'draft_content' in updates || 'final_content' in updates;
    let currentPost: { draft_content: string | null; final_content: string | null; team_profile_id: string | null } | null = null;
    if (hasTextChanges) {
      const { data: existing } = await supabase
        .from('cp_pipeline_posts')
        .select('draft_content, final_content, team_profile_id')
        .eq('id', id)
        .eq('user_id', session.user.id)
        .single();
      currentPost = existing;
    }

    const { data, error } = await supabase
      .from('cp_pipeline_posts')
      .update(updates)
      .eq('id', id)
      .eq('user_id', session.user.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Capture edits fire-and-forget (never blocks the response)
    if (currentPost && hasTextChanges) {
      try {
        const scope = await requireTeamScope(session.user.id);
        if (scope?.teamId) {
          const teamId = scope.teamId;
          const profileId = currentPost.team_profile_id || null;

          if (updates.draft_content && currentPost.draft_content) {
            captureEdit(supabase, {
              teamId,
              profileId,
              contentType: 'post',
              contentId: id,
              fieldName: 'draft_content',
              originalText: currentPost.draft_content,
              editedText: updates.draft_content as string,
            }).catch(() => {});
          }

          if (updates.final_content && currentPost.final_content) {
            captureEdit(supabase, {
              teamId,
              profileId,
              contentType: 'post',
              contentId: id,
              fieldName: 'final_content',
              originalText: currentPost.final_content,
              editedText: updates.final_content as string,
            }).catch(() => {});
          }
        }
      } catch {
        // Edit capture must never affect the save flow
      }
    }

    return NextResponse.json({ post: data });
  } catch (error) {
    logError('cp/posts', error, { step: 'post_update_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const { error } = await supabase
      .from('cp_pipeline_posts')
      .delete()
      .eq('id', id)
      .eq('user_id', session.user.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logError('cp/posts', error, { step: 'post_delete_error' });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
